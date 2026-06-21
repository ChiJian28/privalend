import { Router } from "express";
import { emitInspectorEvent } from "../websocket.js";
import { runAgentWorkflow, runApplicationPhase } from "../t3n/agent-workflow.js";
import { createWorkflowSession, consumeWorkflowSession } from "../t3n/workflow-session.js";
const DEFAULT_LOAN = { amount: 50000, termMonths: 36, purpose: "personal" };
function withSession(userDid, loanRequest, result) {
    const enriched = { ...result, userDid };
    if (result.step === "offers_ready") {
        enriched.sessionId = createWorkflowSession({
            userDid,
            loanRequest,
            fraudCheck: result.fraudCheck,
            eligibility: result.eligibility,
            offers: result.offers,
        });
    }
    return enriched;
}
export function createApiRouter(privalend, consortium) {
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
            const result = await runAgentWorkflow(userDid || "did:t3n:demo_user_001", {
                amount: loanAmount || 50000,
                termMonths: termMonths || 36,
                purpose: purpose || "home_improvement",
            }, privalend, consortium);
            res.json({ success: true, result });
        }
        catch (error) {
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
            const { sessionId } = req.body;
            if (sessionId) {
                const session = consumeWorkflowSession(sessionId);
                if (!session) {
                    return res.status(404).json({ error: "Session expired or not found. Run workflow start first." });
                }
                const result = await runApplicationPhase(session.userDid, session.loanRequest, session.eligibility, selectedOfferId, session.offers, privalend, consortium);
                return res.json({ success: true, result });
            }
            const result = await runAgentWorkflow(userDid || "did:t3n:demo_user_001", {
                amount: loanAmount || 50000,
                termMonths: termMonths || 36,
                purpose: purpose || "home_improvement",
            }, privalend, consortium, selectedOfferId);
            res.json({ success: true, result });
        }
        catch (error) {
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
     * Unified demo endpoint: handles personas, custom profiles, and default demo.
     * All paths go through REAL T3N TEE execution.
     *
     * Body options:
     *   - { persona: "alice" | "bob" | "charlie" }
     *   - { profile: { annual_income, total_debt, nationality } }
     *   - {} (default: Alan Turing demo)
     */
    router.post("/demo/start", async (req, res) => {
        try {
            if (!privalend || !consortium) {
                return res.status(503).json({
                    error: "Tenants not deployed yet. Run setup:tenants first.",
                });
            }
            const { profile, persona } = req.body || {};
            // Persona mode: predefined user profiles
            if (persona) {
                const personas = {
                    alice: { userDid: "did:t3n:demo_user_alice", income: 150000, debt: 10000, nationality: "US" },
                    bob: { userDid: "did:t3n:demo_user_bob_flagged", income: 45000, debt: 35000, nationality: "UK", flagged: true },
                    charlie: { userDid: "did:t3n:demo_user_charlie", income: 52000, debt: 28000, nationality: "SG" },
                };
                const p = personas[persona] || personas.alice;
                emitInspectorEvent({
                    type: "system",
                    step: 0,
                    title: `🎬 Persona: ${persona.charAt(0).toUpperCase() + persona.slice(1)}`,
                    content: `Profile sealed into T3N KV store (bypasses Agent).\nIncome: $${p.income.toLocaleString()}, Debt: $${p.debt.toLocaleString()}\nNationality: ${p.nationality}${p.flagged ? "\n⚠️ This user exists in the Fraud Blacklist" : ""}\n\n🔒 All data processed inside Intel TDX enclave.`,
                    highlight: "blue",
                });
                const profileInput = {
                    annual_income: p.income,
                    total_debt: p.debt,
                    nationality: p.nationality,
                };
                const result = withSession(p.userDid, { amount: 50000, termMonths: 36, purpose: "personal" }, await runAgentWorkflow(p.userDid, { amount: 50000, termMonths: 36, purpose: "personal" }, privalend, consortium, undefined, profileInput, p.flagged));
                return res.json({ success: true, result, userDid: p.userDid, sessionId: result.sessionId });
            }
            // Custom profile mode: user-provided financial data → sealed directly into TEE
            if (profile) {
                const { annual_income, total_debt, nationality } = profile;
                emitInspectorEvent({
                    type: "system",
                    step: 0,
                    title: "🔒 Custom Profile — Sealed in T3N Vault",
                    content: `User financial data encrypted and stored directly into TEE KV store.\nAgent has ZERO access to this data.\n\nThe TEE contract will compute credit score internally.`,
                    highlight: "blue",
                });
                const profileInput = { annual_income, total_debt, nationality };
                const customDid = "did:t3n:custom_user";
                const result = withSession(customDid, DEFAULT_LOAN, await runAgentWorkflow(customDid, DEFAULT_LOAN, privalend, consortium, undefined, profileInput));
                return res.json({ success: true, result, userDid: customDid, sessionId: result.sessionId });
            }
            // Default: original Alan Turing demo (uses fallback profile in contract)
            emitInspectorEvent({
                type: "system",
                step: 0,
                title: "🎬 Demo Mode Activated",
                content: `Pre-configured user: Alan Turing\nFinancial Profile: stored in T3N KV store\nRequesting: $50,000 personal loan, 36 months\n\n🔒 All processing inside Intel TDX enclave.`,
                highlight: "blue",
            });
            const alanDid = "did:t3n:demo_user_alan_turing";
            const result = withSession(alanDid, { amount: 50000, termMonths: 36, purpose: "home_improvement" }, await runAgentWorkflow(alanDid, { amount: 50000, termMonths: 36, purpose: "home_improvement" }, privalend, consortium));
            res.json({ success: true, result, userDid: alanDid, sessionId: result.sessionId });
        }
        catch (error) {
            const requestId = error.message?.match(/\[([0-9a-f-]{36})\]/i)?.[1];
            res.status(500).json({
                error: error.message,
                request_id: requestId ?? null,
                hint: requestId
                    ? "T3N testnet TEE internal_error — not a local config issue. Report request_id to devrel@terminal3.io"
                    : undefined,
            });
        }
    });
    /**
     * POST /api/demo/apply
     * Demo mode: submit application for a specific offer
     */
    router.post("/demo/apply", async (req, res) => {
        try {
            const { selectedOfferId, sessionId } = req.body;
            if (!privalend || !consortium) {
                return res.status(503).json({
                    error: "Tenants not deployed yet. Run setup:tenants first.",
                });
            }
            if (!sessionId) {
                return res.status(400).json({ error: "sessionId is required — run /api/demo/start first" });
            }
            if (!selectedOfferId) {
                return res.status(400).json({ error: "selectedOfferId is required" });
            }
            const session = consumeWorkflowSession(sessionId);
            if (!session) {
                return res.status(404).json({ error: "Session expired or not found. Start the workflow again." });
            }
            const result = await runApplicationPhase(session.userDid, session.loanRequest, session.eligibility, selectedOfferId, session.offers, privalend, consortium);
            res.json({ success: true, result });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    /**
     * GET /api/tee-health
     * Probes T3N testnet TEE contract execution (diagnostic)
     */
    router.get("/tee-health", async (_req, res) => {
        if (!consortium) {
            return res.status(503).json({ tee: "unavailable", reason: "consortium not deployed" });
        }
        const checks = {
            node: "https://cn-api.sg.testnet.t3n.terminal3.io",
            tenant_status: "unknown",
            tee_execute: "unknown",
            tee_logs: "unknown",
        };
        try {
            const me = await consortium.auth.tenantClient.tenant.me();
            checks.tenant_status = me.status ?? "ok";
            checks.log_max_entries = me.quotas?.log_max_entries ?? 0;
        }
        catch (e) {
            checks.tenant_status = `error: ${e.message}`;
        }
        try {
            await consortium.auth.tenantClient.contracts.execute("fraud-check", {
                version: consortium.scriptVersion,
                functionName: "check-blacklist",
                input: { user_did: "did:t3n:health_probe" },
            });
            checks.tee_execute = "ok";
        }
        catch (e) {
            const match = e.message?.match(/\[([0-9a-f-]{36})\]/i);
            checks.tee_execute = "failed";
            checks.tee_error = e.message;
            checks.request_id = match?.[1] ?? null;
            checks.hint = "T3N testnet TEE execution returning internal_error — report request_id to devrel@terminal3.io";
        }
        try {
            const logs = await consortium.auth.tenantClient.contracts.logs("fraud-check", { sinceSeq: 0, limit: 5 });
            checks.tee_logs = logs.entries.length > 0 ? `${logs.entries.length} entries` : "empty (no successful runs yet)";
        }
        catch (e) {
            checks.tee_logs = `error: ${e.message}`;
        }
        const healthy = checks.tee_execute === "ok";
        res.status(healthy ? 200 : 503).json({ tee: healthy ? "healthy" : "degraded", checks });
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
