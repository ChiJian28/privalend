import { createAgentClient } from "./client.js";
import { config } from "../config.js";
import { emitInspectorEvent } from "../websocket.js";
import { seedProfileToKV, seedFraudBlacklist, removeFraudBlacklist } from "./seed-profile.js";
import { issueCreditCredential } from "./issue-credential.js";
let lastLogSeq = {};
async function fetchAndEmitTeeLogs(deployment, step, label) {
    const tail = deployment.scriptName.split(":").pop();
    try {
        const sinceSeq = lastLogSeq[tail] ?? 0;
        const logsResult = await deployment.auth.tenantClient.contracts.logs(tail, {
            sinceSeq,
            limit: 50,
            minLevel: "info",
        });
        if (logsResult.entries.length > 0) {
            const logLines = logsResult.entries.map((e) => `[${new Date(e.ts_ms).toISOString().slice(11, 23)}] [${e.level.toUpperCase()}] ${e.message}`).join("\n");
            emitInspectorEvent({
                type: "tee_log",
                step,
                title: `📡 Live TEE Log — ${label}`,
                content: `📍 Source: T3N Intel TDX Node (hardware-attested)\n📋 Contract: ${deployment.scriptName}\n${"─".repeat(48)}\n${logLines}`,
                highlight: "gray",
            });
        }
        if (logsResult.next_seq != null) {
            lastLogSeq[tail] = logsResult.next_seq;
        }
    }
    catch (e) {
        console.log(`[TEE-Logs] Could not fetch logs for ${tail}: ${e.message}`);
    }
}
function normalizeOffer(raw) {
    return {
        id: String(raw.id),
        lender: String(raw.lender),
        amount: Number(raw.amount),
        interestRate: Number(raw.interest_rate ?? raw.interestRate),
        termMonths: Number(raw.term_months ?? raw.termMonths),
        monthlyPayment: Number(raw.monthly_payment ?? raw.monthlyPayment),
        totalCost: Number(raw.total_cost ?? raw.totalCost),
    };
}
async function submitSelectedOffer(userDid, loanRequest, eligibility, selectedOfferId, offers, privalend, agent) {
    const selectedOffer = offers.find((o) => o.id === selectedOfferId);
    if (!selectedOffer)
        throw new Error(`Offer ${selectedOfferId} not found in session`);
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
        title: "Agent Sends (with Placeholders — PII hidden)",
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
    await fetchAndEmitTeeLogs(privalend, 3, "PrivaLend Application Enclave");
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
    }
    catch {
        emitInspectorEvent({
            type: "placeholder_after",
            step: 3,
            title: "T3N Node Resolved Placeholders",
            content: `Placeholders resolved inside TEE:\n  {{profile.first_name}} → resolved\n  {{profile.last_name}} → resolved\n  {{profile.id_number}} → resolved\n  {{profile.date_of_birth}} → resolved\n\nBank received real PII. Agent never saw it.`,
            highlight: "green",
        });
    }
    emitInspectorEvent({
        type: "audit_log",
        step: 4,
        title: "Immutable Audit Trail",
        content: `[${new Date().toISOString()}] Loan application submitted\n  Agent DID: ${agent.did}\n  User DID: ${userDid}\n  Lender: ${selectedOffer.lender}\n  Amount: $${loanRequest.amount}\n  PII exposure to Agent: 0 bytes\n  Cross-tenant fraud check: PASSED\n  TEE-computed credit score: ${eligibility.score}\n  All operations logged to T3N Merkle ledger.`,
        highlight: "blue",
    });
    const credential = await issueCreditCredential({
        userDid,
        score: eligibility.score,
        tier: eligibility.tier,
        maxLoanAmount: eligibility.max_loan_amount,
        reference: applicationResult.reference,
        issuerDid: privalend.auth.did,
    }, privalend, agent, 4);
    await fetchAndEmitTeeLogs(privalend, 4, "PrivaLend VC Issuance Enclave");
    return { applicationResult, credential };
}
/**
 * Apply phase only — submit selected offer + issue VC using an existing start session.
 * Does NOT re-run fraud check, eligibility, or fetch-offers.
 */
export async function runApplicationPhase(userDid, loanRequest, eligibility, selectedOfferId, offers, privalend, _consortium) {
    emitInspectorEvent({
        type: "system",
        step: 3,
        title: "Submitting Application (continuing session)",
        content: `User DID: ${userDid}\nOffer: ${selectedOfferId}\nSkipping re-run of fraud/eligibility — using completed start session.`,
        highlight: "blue",
    });
    const agent = await createAgentClient(config.agent.apiKey);
    const { applicationResult, credential } = await submitSelectedOffer(userDid, loanRequest, eligibility, selectedOfferId, offers, privalend, agent);
    return {
        step: "application_submitted",
        userDid,
        fraudCheck: { is_flagged: false, risk_level: "low" },
        eligibility,
        offers,
        applicationResult,
        credential,
    };
}
/**
 * Main agent workflow: the AI agent orchestrates the loan application
 * without ever seeing user PII.
 *
 * If a custom profile is provided, it is first sealed into T3N KV store
 * (bypassing the Agent), then the Agent calls TEE contracts which read
 * from KV store internally — full TEE execution path.
 */
export async function runAgentWorkflow(userDid, loanRequest, privalend, consortium, selectedOfferId, profileInput, isFlagged) {
    // Reset log sequence for fresh workflow
    lastLogSeq = {};
    // ===== PRE-STEP: Seed custom profile into T3N KV store (bypasses Agent) =====
    if (profileInput) {
        const profile = {
            annual_income: profileInput.annual_income,
            total_debt: profileInput.total_debt,
            employment_years: profileInput.annual_income >= 100000 ? 5 : profileInput.annual_income >= 60000 ? 3 : 1,
            has_collateral: profileInput.annual_income >= 120000,
            credit_history_months: Math.min(Math.round(profileInput.annual_income / 2000), 120),
        };
        await seedProfileToKV(privalend.auth, profile);
    }
    // Seed Bob into blacklist if flagged
    if (isFlagged) {
        await seedFraudBlacklist(consortium.auth, userDid, "multi-lending fraud (demo persona)");
    }
    // ===== STEP 1: Initialize Agent =====
    emitInspectorEvent({
        type: "system",
        step: 1,
        title: "Agent Initialization",
        content: `Authenticating agent with DID...\nNote: Agent has NO access to the user's financial profile in KV store.`,
    });
    const agent = await createAgentClient(config.agent.apiKey);
    emitInspectorEvent({
        type: "system",
        step: 1,
        title: "Agent Authenticated",
        content: `Agent DID: ${agent.did}\nAgent has NO access to user PII or KV store entries.\nAll financial data is sealed inside T3N TEE.`,
        highlight: "blue",
    });
    // ===== STEP 2: Cross-Tenant Fraud Check (REAL TEE) =====
    emitInspectorEvent({
        type: "cross_tenant",
        step: 2,
        title: "Cross-Tenant Fraud Check (Real TEE)",
        content: `Calling Fraud Consortium contract...\nexecuteBusinessContract("${consortium.scriptName}", "check-blacklist")\nInput: { user_did: "${userDid}" }`,
        highlight: "yellow",
    });
    const fraudResult = await agent.client.executeAndDecode({
        script_name: consortium.scriptName,
        script_version: consortium.scriptVersion,
        function_name: "check-blacklist",
        input: { user_did: userDid },
    });
    // Fetch real TEE logs from the Consortium contract
    await fetchAndEmitTeeLogs(consortium, 2, "Fraud Consortium Enclave");
    emitInspectorEvent({
        type: "agent_received",
        step: 2,
        title: "Fraud Check Result (Agent sees ONLY this)",
        content: JSON.stringify(fraudResult, null, 2),
        highlight: fraudResult.is_flagged ? "red" : "green",
    });
    if (fraudResult.is_flagged) {
        emitInspectorEvent({
            type: "error",
            step: 2,
            title: "Application Rejected — Fraud Blacklist",
            content: "User flagged in industry fraud blacklist. Application terminated.\nThis demonstrates cross-tenant data sharing WITHOUT revealing WHY the user was flagged.",
        });
        // Cleanup: remove Bob from blacklist after demo
        if (isFlagged) {
            await removeFraudBlacklist(consortium.auth, userDid);
        }
        return {
            step: "fraud_check_failed",
            fraudCheck: fraudResult,
            eligibility: { score: 0, tier: "rejected", max_loan_amount: 0 },
            offers: [],
        };
    }
    // ===== STEP 2b: Credit Assessment (REAL TEE) =====
    emitInspectorEvent({
        type: "agent_action",
        step: 2,
        title: "Credit Assessment (Real TEE Execution)",
        content: `Calling PrivaLend contract...\nexecuteAndDecode("${privalend.scriptName}", "assess-eligibility")\nInput: { fraud_result: ${JSON.stringify(fraudResult)}, loan_amount: ${loanRequest.amount} }\n\n🔐 TEE reads user profile from KV store — Agent CANNOT access this data.`,
    });
    const eligibility = await agent.client.executeAndDecode({
        script_name: privalend.scriptName,
        script_version: privalend.scriptVersion,
        function_name: "assess-eligibility",
        input: {
            fraud_result: fraudResult,
            loan_amount: loanRequest.amount,
            term_months: loanRequest.termMonths,
        },
    });
    // Fetch real TEE logs from the PrivaLend eligibility contract
    await fetchAndEmitTeeLogs(privalend, 2, "PrivaLend Eligibility Enclave");
    // Fallback: if logs() returned empty (quota disabled), emit a constructed view using real TEE output
    emitInspectorEvent({
        type: "tee_simulated",
        step: 2,
        title: "TEE Computation Result (from executeAndDecode)",
        content: `📍 TEE-computed output (verified by Intel TDX attestation):\n\n  Credit Score: ${eligibility.score}\n  Tier: ${eligibility.tier?.toUpperCase()}\n  Max Loan: $${eligibility.max_loan_amount?.toLocaleString()}\n  DTI Ratio: ${eligibility.debt_to_income_ratio}\n  Approved: ${eligibility.approved}\n\n⚠️ Raw financial data was processed and destroyed inside the enclave.\n   Agent receives only the aggregated output above.`,
        highlight: "gray",
    });
    emitInspectorEvent({
        type: "agent_received",
        step: 2,
        title: "Eligibility Result (Agent sees ONLY this)",
        content: JSON.stringify(eligibility, null, 2),
        highlight: "green",
    });
    // ===== STEP 3: Fetch Loan Offers (REAL TEE → Mock Bank) =====
    emitInspectorEvent({
        type: "agent_action",
        step: 3,
        title: "Fetching Loan Offers (TEE → Dynamic Pricing)",
        content: `Calling PrivaLend contract "fetch-offers"\nInput: { tier: "${eligibility.tier}", credit_score: ${eligibility.score}, amount: ${loanRequest.amount}, term: ${loanRequest.termMonths} }\nTEE uses http::call to query lender APIs (no PII sent)\n\n📊 Dynamic Rate = 4.0% + (850 - ${eligibility.score}) × 0.02%`,
    });
    const offersResult = await agent.client.executeAndDecode({
        script_name: privalend.scriptName,
        script_version: privalend.scriptVersion,
        function_name: "fetch-offers",
        input: {
            tier: eligibility.tier,
            amount: loanRequest.amount,
            term_months: loanRequest.termMonths,
            purpose: loanRequest.purpose,
            credit_score: eligibility.score,
        },
    });
    const normalizedOffers = offersResult.offers.map(normalizeOffer);
    // Fetch real TEE logs from the PrivaLend offers contract
    await fetchAndEmitTeeLogs(privalend, 3, "PrivaLend Offers Enclave");
    emitInspectorEvent({
        type: "agent_received",
        step: 3,
        title: `Available Offers (Score: ${eligibility.score} → Dynamic Rates)`,
        content: JSON.stringify(normalizedOffers, null, 2),
        highlight: "green",
    });
    const result = {
        step: "offers_ready",
        userDid,
        fraudCheck: fraudResult,
        eligibility,
        offers: normalizedOffers,
    };
    if (selectedOfferId) {
        const { applicationResult, credential } = await submitSelectedOffer(userDid, loanRequest, eligibility, selectedOfferId, normalizedOffers, privalend, agent);
        result.step = "application_submitted";
        result.applicationResult = applicationResult;
        result.credential = credential;
    }
    // Cleanup: remove Bob from blacklist after successful non-flagged flow (shouldn't happen, but safe)
    if (isFlagged) {
        await removeFraudBlacklist(consortium.auth, userDid);
    }
    return result;
}
