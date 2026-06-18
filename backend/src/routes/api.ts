import { Router } from "express";
import { emitInspectorEvent } from "../websocket.js";
import { runAgentWorkflow, type WorkflowResult } from "../t3n/agent-workflow.js";
import type { TenantDeployment } from "../t3n/tenant-setup.js";

export interface UserProfile {
  annual_income: number;
  total_debt: number;
  nationality: string;
}

/**
 * Credit scoring engine: computes a FICO-like score from financial data.
 * Score range: 300-850
 */
function computeCreditScore(profile: UserProfile): {
  score: number;
  tier: string;
  max_loan_amount: number;
  debt_to_income_ratio: number;
  approved: boolean;
} {
  const dti = profile.total_debt / Math.max(profile.annual_income, 1);

  // Base score from DTI ratio (lower is better)
  let score = 850;
  if (dti > 0.5) score -= 300;
  else if (dti > 0.4) score -= 200;
  else if (dti > 0.3) score -= 120;
  else if (dti > 0.2) score -= 60;
  else if (dti > 0.1) score -= 20;

  // Income factor boost
  if (profile.annual_income >= 150000) score += 30;
  else if (profile.annual_income >= 100000) score += 20;
  else if (profile.annual_income >= 60000) score += 10;
  else if (profile.annual_income < 30000) score -= 50;

  score = Math.max(300, Math.min(850, score));

  const tier = score >= 750 ? "prime" : score >= 650 ? "near_prime" : "subprime";
  const maxLoan = score >= 750
    ? Math.min(profile.annual_income * 4, 500000)
    : score >= 650
      ? Math.min(profile.annual_income * 2.5, 200000)
      : Math.min(profile.annual_income * 1, 50000);
  const approved = score >= 550;

  return {
    score,
    tier,
    max_loan_amount: Math.round(maxLoan),
    debt_to_income_ratio: Math.round(dti * 1000) / 1000,
    approved,
  };
}

export function createApiRouter(
  privalend: TenantDeployment | null,
  consortium: TenantDeployment | null
): Router {
  const router = Router();

  /**
   * POST /api/workflow/start
   * Starts the full agent workflow: fraud check → eligibility → offers
   */
  router.post("/workflow/start", async (req, res) => {
    try {
      const { userDid, loanAmount, termMonths, purpose } = req.body;

      if (!privalend || !consortium) {
        return res.status(503).json({
          error: "Tenants not deployed yet. Run setup:tenants first.",
        });
      }

      emitInspectorEvent({
        type: "system",
        step: 0,
        title: "Workflow Started",
        content: `User: ${userDid}\nLoan: $${loanAmount} / ${termMonths} months\nPurpose: ${purpose}`,
        highlight: "blue",
      });

      const result = await runAgentWorkflow(
        userDid || "did:t3n:demo_user_001",
        {
          amount: loanAmount || 50000,
          termMonths: termMonths || 36,
          purpose: purpose || "home_improvement",
        },
        privalend,
        consortium
      );

      res.json({ success: true, result });
    } catch (error: any) {
      emitInspectorEvent({
        type: "error",
        step: 0,
        title: "Workflow Error",
        content: error.message,
      });
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/workflow/apply
   * Submit application for a selected offer
   */
  router.post("/workflow/apply", async (req, res) => {
    try {
      const { userDid, loanAmount, termMonths, purpose, selectedOfferId } = req.body;

      if (!privalend || !consortium) {
        return res.status(503).json({
          error: "Tenants not deployed yet. Run setup:tenants first.",
        });
      }

      if (!selectedOfferId) {
        return res.status(400).json({ error: "selectedOfferId is required" });
      }

      const result = await runAgentWorkflow(
        userDid || "did:t3n:demo_user_001",
        {
          amount: loanAmount || 50000,
          termMonths: termMonths || 36,
          purpose: purpose || "home_improvement",
        },
        privalend,
        consortium,
        selectedOfferId
      );

      res.json({ success: true, result });
    } catch (error: any) {
      emitInspectorEvent({
        type: "error",
        step: 0,
        title: "Application Error",
        content: error.message,
      });
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/demo/start
   * Demo mode: runs full workflow with pre-configured demo data
   * (for hackathon presentation)
   */
  router.post("/demo/start", async (req, res) => {
    try {
      if (!privalend || !consortium) {
        return res.status(503).json({
          error: "Tenants not deployed yet. Run setup:tenants first.",
        });
      }

      const { profile, persona } = req.body || {};

      // Custom profile mode: user provides their own financial data
      if (profile) {
        const { annual_income, total_debt, nationality } = profile as UserProfile;
        const eligibility = computeCreditScore({ annual_income, total_debt, nationality });

        emitInspectorEvent({
          type: "system",
          step: 0,
          title: "🔒 Custom Profile — Data Sealed in T3N Vault",
          content: `Custom financial data encrypted.\nT3N TEE computing credit score...\nPrivaLend Agent has NO access to raw financial data.`,
          highlight: "blue",
        });

        // Simulate the workflow with dynamic credit scoring
        const result = await runAgentWorkflow(
          "did:t3n:custom_user",
          { amount: 50000, termMonths: 36, purpose: "personal" },
          privalend,
          consortium,
          undefined,
          { profile: { annual_income, total_debt, nationality }, eligibility }
        );

        return res.json({ success: true, result });
      }

      // Persona mode: predefined personas
      if (persona) {
        const personas: Record<string, { userDid: string; income: number; debt: number; nationality: string; flagged?: boolean }> = {
          alice: { userDid: "did:t3n:demo_user_alice", income: 150000, debt: 10000, nationality: "US" },
          bob: { userDid: "did:t3n:demo_user_bob_flagged", income: 45000, debt: 35000, nationality: "UK", flagged: true },
          charlie: { userDid: "did:t3n:demo_user_charlie", income: 52000, debt: 28000, nationality: "SG" },
        };
        const p = personas[persona] || personas.alice;
        const eligibility = computeCreditScore({ annual_income: p.income, total_debt: p.debt, nationality: p.nationality });

        emitInspectorEvent({
          type: "system",
          step: 0,
          title: `🎬 Persona Mode: ${persona.charAt(0).toUpperCase() + persona.slice(1)}`,
          content: `Persona: ${persona}\nIncome: $${p.income.toLocaleString()}, Debt: $${p.debt.toLocaleString()}\nNationality: ${p.nationality}${p.flagged ? "\n⚠️ This user is in the Fraud Blacklist" : ""}`,
          highlight: "blue",
        });

        const result = await runAgentWorkflow(
          p.userDid,
          { amount: 50000, termMonths: 36, purpose: "personal" },
          privalend,
          consortium,
          undefined,
          { profile: { annual_income: p.income, total_debt: p.debt, nationality: p.nationality }, eligibility, isFlagged: p.flagged }
        );

        return res.json({ success: true, result });
      }

      // Default: original demo mode (Alan Turing)
      emitInspectorEvent({
        type: "system",
        step: 0,
        title: "🎬 Demo Mode Activated",
        content: `Pre-configured user: Alan Turing\nFinancial Profile: Income $85K, Debt $12K\nRequesting: $50,000 personal loan, 36 months`,
        highlight: "blue",
      });

      const result = await runAgentWorkflow(
        "did:t3n:demo_user_alan_turing",
        { amount: 50000, termMonths: 36, purpose: "home_improvement" },
        privalend,
        consortium
      );

      res.json({ success: true, result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/demo/apply
   * Demo mode: submit application for a specific offer
   */
  router.post("/demo/apply", async (req, res) => {
    try {
      const { selectedOfferId } = req.body;

      if (!privalend || !consortium) {
        return res.status(503).json({
          error: "Tenants not deployed yet. Run setup:tenants first.",
        });
      }

      const result = await runAgentWorkflow(
        "did:t3n:demo_user_alan_turing",
        { amount: 50000, termMonths: 36, purpose: "home_improvement" },
        privalend,
        consortium,
        selectedOfferId || "offer_dbs_003"
      );

      res.json({ success: true, result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/status
   * Returns deployment status of both tenants
   */
  router.get("/status", (_req, res) => {
    res.json({
      privalend: privalend
        ? { deployed: true, scriptName: privalend.scriptName, contractId: privalend.contractId }
        : { deployed: false },
      consortium: consortium
        ? { deployed: true, scriptName: consortium.scriptName, contractId: consortium.contractId }
        : { deployed: false },
    });
  });

  return router;
}
