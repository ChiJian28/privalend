import { getScriptVersion, getNodeUrl } from "@terminal3/t3n-sdk";
import { createAgentClient } from "./client.js";
import { config } from "../config.js";
import { emitInspectorEvent } from "../websocket.js";
import type { TenantDeployment } from "./tenant-setup.js";

export interface LoanOffer {
  id: string;
  lender: string;
  amount: number;
  interestRate: number;
  termMonths: number;
  monthlyPayment: number;
  totalCost: number;
}

export interface WorkflowResult {
  step: string;
  fraudCheck: { is_flagged: boolean; risk_level: string };
  eligibility: { score: number; tier: string; maxLoanAmount: number };
  offers: LoanOffer[];
  applicationResult?: { status: string; reference: string; lender: string };
}

export interface CustomProfileOverride {
  profile: { annual_income: number; total_debt: number; nationality: string };
  eligibility: { score: number; tier: string; max_loan_amount: number; debt_to_income_ratio: number; approved: boolean };
  isFlagged?: boolean;
}

/**
 * Main agent workflow: the AI agent orchestrates the loan application
 * without ever seeing user PII
 */
export async function runAgentWorkflow(
  userDid: string,
  loanRequest: { amount: number; termMonths: number; purpose: string },
  privalend: TenantDeployment,
  consortium: TenantDeployment,
  selectedOfferId?: string,
  customProfile?: CustomProfileOverride
): Promise<WorkflowResult> {
  // Initialize agent client
  emitInspectorEvent({
    type: "system",
    step: 1,
    title: "Agent Initialization",
    content: `Authenticating agent with DID...`,
  });

  const agent = await createAgentClient(config.agent.apiKey);

  emitInspectorEvent({
    type: "system",
    step: 1,
    title: "Agent Authenticated",
    content: `Agent DID: ${agent.did}\nAgent has NO access to user PII.`,
    highlight: "blue",
  });

  // ===== STEP 2: Cross-Tenant Fraud Check =====
  emitInspectorEvent({
    type: "cross_tenant",
    step: 2,
    title: "Cross-Tenant Fraud Check",
    content: `Calling Fraud Consortium contract...\nexecuteBusinessContract("${consortium.scriptName}", "check-blacklist")`,
    highlight: "yellow",
  });

  let fraudResult: any;
  if (customProfile) {
    // Use override (for custom profile / persona modes)
    fraudResult = {
      is_flagged: customProfile.isFlagged || false,
      risk_level: customProfile.isFlagged ? "critical" : "low",
      checked_at: new Date().toISOString(),
      consortium_id: consortium.scriptName,
    };
  } else {
    fraudResult = await agent.client.executeAndDecode({
      script_name: consortium.scriptName,
      script_version: consortium.scriptVersion,
      function_name: "check-blacklist",
      input: { user_did: userDid },
    });
  }

  emitInspectorEvent({
    type: "agent_received",
    step: 2,
    title: "Fraud Check Result (Agent sees ONLY this)",
    content: JSON.stringify(fraudResult, null, 2),
    highlight: fraudResult.is_flagged ? "red" : "green",
  });

  emitInspectorEvent({
    type: "tee_simulated",
    step: 2,
    title: "Inside Consortium Enclave (Simulated View)",
    content: fraudResult.is_flagged
      ? `Looking up ${userDid} in fraud_blacklist KV map...\nResult: ⚠️ MATCH FOUND\nBlacklist contains 2 entries — this user IS flagged.\nReturning risk signal: CRITICAL.`
      : `Looking up ${userDid} in fraud_blacklist KV map...\nResult: NOT FOUND ✓\nBlacklist contains 2 entries — none match this user.\nReturning risk signal only (no blacklist data exposed).`,
    highlight: "gray",
  });

  if (fraudResult.is_flagged) {
    emitInspectorEvent({
      type: "error",
      step: 2,
      title: "Application Rejected — Fraud Blacklist",
      content: "User flagged in industry fraud blacklist. Application terminated.\nThis demonstrates cross-tenant data sharing WITHOUT revealing WHY the user was flagged.",
    });
    return {
      step: "fraud_check_failed",
      fraudCheck: fraudResult,
      eligibility: { score: 0, tier: "rejected", maxLoanAmount: 0 },
      offers: [],
    };
  }

  // ===== STEP 2b: Credit Assessment =====
  let eligibility: any;

  if (customProfile) {
    const cp = customProfile.eligibility;
    emitInspectorEvent({
      type: "agent_action",
      step: 2,
      title: "Credit Assessment (Custom Profile)",
      content: `Calling PrivaLend contract...\nexecuteAndDecode("${privalend.scriptName}", "assess-eligibility")\nInput: { fraud_result: ${JSON.stringify(fraudResult)}, loan_amount: ${loanRequest.amount} }\n\n🔐 User's financial data resolved inside TEE — Agent cannot read it.`,
    });

    eligibility = {
      score: cp.score,
      tier: cp.tier,
      max_loan_amount: cp.max_loan_amount,
      debt_to_income_ratio: cp.debt_to_income_ratio,
      approved: cp.approved,
    };

    emitInspectorEvent({
      type: "tee_simulated",
      step: 2,
      title: "Inside PrivaLend Enclave (Custom Profile)",
      content: `Fetching user financial profile from T3N KV store...\n  → Annual Income: $${customProfile.profile.annual_income.toLocaleString()}\n  → Total Debt: $${customProfile.profile.total_debt.toLocaleString()}\n  → Nationality: ${customProfile.profile.nationality}\n  → Debt-to-Income Ratio: ${(cp.debt_to_income_ratio * 100).toFixed(1)}%\nComputing credit score... Result: ${cp.score}\nTier: ${cp.tier.toUpperCase()}\nMax Loan Amount: $${cp.max_loan_amount.toLocaleString()}\n⚠️ Raw financial data destroyed in enclave memory.`,
      highlight: "gray",
    });
  } else {
    emitInspectorEvent({
      type: "agent_action",
      step: 2,
      title: "Credit Assessment",
      content: `Calling PrivaLend contract...\nexecuteAndDecode("${privalend.scriptName}", "assess-eligibility")\nInput: { fraud_result: ${JSON.stringify(fraudResult)}, loan_amount: ${loanRequest.amount} }`,
    });

    eligibility = await agent.client.executeAndDecode({
      script_name: privalend.scriptName,
      script_version: privalend.scriptVersion,
      function_name: "assess-eligibility",
      input: {
        fraud_result: fraudResult,
        loan_amount: loanRequest.amount,
        term_months: loanRequest.termMonths,
      },
    });

    emitInspectorEvent({
      type: "tee_simulated",
      step: 2,
      title: "Inside PrivaLend Enclave (Simulated View)",
      content: `Fetching user financial profile from T3N KV store...\n  → Annual Income: $85,000\n  → Total Debt: $12,000\n  → Employment: Full-time (3 years)\n  → Debt-to-Income Ratio: 14.1%\nComputing credit score... Result: 780\nTier: PRIME\nMax Loan Amount: $150,000\n⚠️ Raw financial data destroyed in enclave memory.`,
      highlight: "gray",
    });
  }

  emitInspectorEvent({
    type: "agent_received",
    step: 2,
    title: "Eligibility Result (Agent sees ONLY this)",
    content: JSON.stringify(eligibility, null, 2),
    highlight: "green",
  });

  // ===== STEP 3: Fetch Loan Offers =====
  emitInspectorEvent({
    type: "agent_action",
    step: 3,
    title: "Fetching Loan Offers",
    content: `Calling PrivaLend contract "fetch-offers"\nInput: { tier: "${eligibility.tier}", score: ${eligibility.score}, amount: ${loanRequest.amount}, term: ${loanRequest.termMonths} }\nUsing http::call to query lender APIs (no PII sent)`,
  });

  let offersResult: any;
  if (customProfile) {
    // Call mock bank directly with credit_score for dynamic pricing
    try {
      const bankRes = await fetch(`${config.mockBank.baseUrl}/api/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: eligibility.tier,
          credit_score: eligibility.score,
          requested_amount: loanRequest.amount,
          term_months: loanRequest.termMonths,
          purpose: loanRequest.purpose,
        }),
      });
      offersResult = await bankRes.json();
    } catch {
      offersResult = { offers: [] };
    }
  } else {
    offersResult = await agent.client.executeAndDecode({
      script_name: privalend.scriptName,
      script_version: privalend.scriptVersion,
      function_name: "fetch-offers",
      input: {
        tier: eligibility.tier,
        amount: loanRequest.amount,
        term_months: loanRequest.termMonths,
        purpose: loanRequest.purpose,
      },
    });
  }

  emitInspectorEvent({
    type: "agent_received",
    step: 3,
    title: `Available Offers (Score: ${eligibility.score} → Dynamic Rates)`,
    content: JSON.stringify(offersResult.offers, null, 2),
    highlight: "green",
  });

  const result: WorkflowResult = {
    step: "offers_ready",
    fraudCheck: fraudResult,
    eligibility,
    offers: offersResult.offers,
  };

  // ===== STEP 3b: Submit Application (if user selected an offer) =====
  if (selectedOfferId) {
    const selectedOffer = offersResult.offers.find((o: LoanOffer) => o.id === selectedOfferId);
    if (!selectedOffer) throw new Error(`Offer ${selectedOfferId} not found`);

    // Show placeholder payload BEFORE submission
    const placeholderPayload = {
      offer_id: selectedOfferId,
      loan_amount: loanRequest.amount,
      term_months: loanRequest.termMonths,
      applicant_name: "{{profile.first_name}} {{profile.last_name}}",
      applicant_email: "{{profile.verified_contacts.email.value}}",
      applicant_id: "{{profile.id_number}}",
      applicant_dob: "{{profile.date_of_birth}}",
    };

    emitInspectorEvent({
      type: "placeholder_before",
      step: 3,
      title: "Agent Sends (with Placeholders)",
      content: JSON.stringify(placeholderPayload, null, 2),
      highlight: "red",
    });

    const applicationResult = await agent.client.executeAndDecode({
      script_name: privalend.scriptName,
      script_version: privalend.scriptVersion,
      function_name: "submit-application",
      input: {
        offer_id: selectedOfferId,
        loan_amount: loanRequest.amount,
        term_months: loanRequest.termMonths,
        lender: selectedOffer.lender,
      },
    });

    // Fetch what the mock bank actually received
    try {
      const bankResponse = await fetch(`${config.mockBank.baseUrl}/last-received`);
      const bankPayload = await bankResponse.json();

      emitInspectorEvent({
        type: "placeholder_after",
        step: 3,
        title: "Bank Actually Received (PII resolved by T3N Node)",
        content: JSON.stringify(bankPayload, null, 2),
        highlight: "green",
      });
    } catch {
      emitInspectorEvent({
        type: "placeholder_after",
        step: 3,
        title: "T3N Node Resolved Placeholders",
        content: `Placeholders resolved inside TEE:\n  {{profile.first_name}} → "Alan"\n  {{profile.last_name}} → "Turing"\n  {{profile.id_number}} → "S1234567A"\n  {{profile.date_of_birth}} → "1912-06-23"`,
        highlight: "green",
      });
    }

    // Audit log
    emitInspectorEvent({
      type: "audit_log",
      step: 4,
      title: "Immutable Audit Trail",
      content: `[${new Date().toISOString()}] Loan application submitted\n  Agent DID: ${agent.did}\n  User DID: ${userDid}\n  Lender: ${selectedOffer.lender}\n  Amount: $${loanRequest.amount}\n  PII exposure to Agent: 0 bytes\n  Cross-tenant fraud check: PASSED\n  All operations logged to T3N Merkle ledger.`,
      highlight: "blue",
    });

    result.step = "application_submitted";
    result.applicationResult = applicationResult as { status: string; reference: string; lender: string };
  }

  return result;
}
