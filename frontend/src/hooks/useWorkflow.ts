"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { buildDemoCredential, clearWalletDemoStorage, type CredentialIssueResult } from "@/lib/credential";
import {
  appEnv,
  DEMO_USER_DIDS,
  fraudCheckScriptName,
  privalendScriptName,
  truncateDidForDisplay,
} from "@/lib/env";

export type WorkflowStep = 0 | 1 | 2 | 3 | 4;

export interface InspectorEvent {
  id: string;
  type: "system" | "agent_action" | "agent_received" | "tee_simulated" | "tee_log" | "placeholder_before" | "placeholder_after" | "cross_tenant" | "audit_log" | "vc_issued" | "error";
  step: number;
  title: string;
  content: string;
  highlight?: "red" | "green" | "yellow" | "blue" | "gray";
  timestamp: number;
}

export interface LoanOffer {
  id: string;
  lender: string;
  amount: number;
  interest_rate: number;
  term_months: number;
  monthly_payment: number;
  total_cost: number;
  features: string[];
}

export interface UserProfile {
  annual_income: number;
  total_debt: number;
  nationality: string;
}

export interface StartOptions {
  persona?: "alice" | "bob" | "charlie";
  profile?: UserProfile;
}

export interface WorkflowState {
  step: WorkflowStep;
  isLoading: boolean;
  isApplying: boolean;
  submittingOfferId: string | null;
  events: InspectorEvent[];
  fraudResult: { is_flagged: boolean; risk_level: string } | null;
  eligibility: { score: number; tier: string; max_loan_amount: number; approved: boolean } | null;
  offers: LoanOffer[];
  applicationResult: { status: string; reference: string; lender: string } | null;
  credential: CredentialIssueResult | null;
  connected: boolean;
  startWorkflow: (options?: StartOptions) => Promise<void>;
  selectOffer: (offerId: string) => Promise<void>;
  reset: () => void;
}

const BACKEND_URL = appEnv.backendUrl;
let eventCounter = 0;

function createEvent(partial: Omit<InspectorEvent, "id" | "timestamp">): InspectorEvent {
  return { ...partial, id: `evt_${++eventCounter}`, timestamp: Date.now() };
}

/** Backend LoanOffer may use camelCase from TEE normalization. */
function normalizeFrontendOffers(raw: Record<string, unknown>[]): LoanOffer[] {
  return raw.map((o) => ({
    id: String(o.id),
    lender: String(o.lender),
    amount: Number(o.amount),
    interest_rate: Number(o.interest_rate ?? o.interestRate),
    term_months: Number(o.term_months ?? o.termMonths),
    monthly_payment: Number(o.monthly_payment ?? o.monthlyPayment),
    total_cost: Number(o.total_cost ?? o.totalCost),
    features: Array.isArray(o.features) ? o.features.map(String) : [],
  }));
}

export function useWorkflow(): WorkflowState {
  const [step, setStep] = useState<WorkflowStep>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [submittingOfferId, setSubmittingOfferId] = useState<string | null>(null);
  const [events, setEvents] = useState<InspectorEvent[]>([]);
  const [fraudResult, setFraudResult] = useState<WorkflowState["fraudResult"]>(null);
  const [eligibility, setEligibility] = useState<WorkflowState["eligibility"]>(null);
  const [offers, setOffers] = useState<LoanOffer[]>([]);
  const [applicationResult, setApplicationResult] = useState<WorkflowState["applicationResult"]>(null);
  const [credential, setCredential] = useState<CredentialIssueResult | null>(null);
  const [connected, setConnected] = useState(false);
  const userDidRef = useRef<string>(DEMO_USER_DIDS.alan);
  const sessionIdRef = useRef<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  /** When true, UI step progression is driven by startWorkflow/selectOffer — not WS events. */
  const liveFlowActiveRef = useRef(false);

  // Try connecting to backend WebSocket
  useEffect(() => {
    const socket = io(BACKEND_URL, { transports: ["websocket"], reconnectionAttempts: 3, timeout: 3000 });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      console.log("[WS] Connected to backend");
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("connect_error", () => {
      setConnected(false);
      console.log("[WS] Backend unavailable — using simulated mode");
    });

    // Listen for real Inspector events from backend (Inspector panel only — not step UI)
    socket.on("inspector_event", (event: InspectorEvent) => {
      setEvents((prev) => [...prev, { ...event, id: `evt_${++eventCounter}` }]);
    });

    return () => { socket.disconnect(); };
  }, []);

  const addEvent = useCallback((partial: Omit<InspectorEvent, "id" | "timestamp">) => {
    setEvents((prev) => [...prev, createEvent(partial)]);
  }, []);

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  /** Live mode: stage step 2→3 UI (caller already showed step 1 while TEE ran). */
  async function playLiveStartSequence(result: {
    step?: string;
    fraudCheck?: { is_flagged: boolean; risk_level: string };
    eligibility?: { score: number; tier: string; max_loan_amount: number; approved: boolean };
    offers?: LoanOffer[];
  }) {
    liveFlowActiveRef.current = true;
    setFraudResult(null);
    setEligibility(null);
    setOffers([]);
    setCredential(null);

    setStep(2);
    await delay(1200); // Industry Fraud Screening — spinner visible
    if (result.fraudCheck) setFraudResult(result.fraudCheck);

    if (result.step === "fraud_check_failed") {
      if (result.eligibility) setEligibility(result.eligibility);
      await delay(800);
      liveFlowActiveRef.current = false;
      return;
    }

    await delay(1200); // Credit Assessment — spinner after fraud completes
    if (result.eligibility) setEligibility(result.eligibility);

    await delay(800);
    setStep(3);
    if (result.offers) setOffers(normalizeFrontendOffers(result.offers as unknown as Record<string, unknown>[]));
    liveFlowActiveRef.current = false;
  }

  /** Live mode: stage apply → success transition. */
  async function playLiveApplySequence(result: {
    applicationResult?: { status: string; reference: string; lender: string };
    credential?: CredentialIssueResult;
  }) {
    liveFlowActiveRef.current = true;
    await delay(1500); // Agent → TEE (placeholders)
    await delay(1200); // TEE → Lender (PII resolved)
    await delay(600);

    if (result.applicationResult) setApplicationResult(result.applicationResult);
    if (result.credential) setCredential(result.credential);
    setStep(4);
    liveFlowActiveRef.current = false;
  }

  // Try calling the real backend API
  const callBackend = useCallback(async (path: string, body?: object): Promise<any | null> => {
    if (!connected) return null;
    try {
      const res = await fetch(`${BACKEND_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.ok) return res.json();
    } catch { /* fallback to simulated */ }
    return null;
  }, [connected]);

  const startWorkflow = useCallback(async (options?: StartOptions) => {
    clearWalletDemoStorage();
    setIsLoading(true);
    setIsApplying(false);
    setSubmittingOfferId(null);
    setEvents([]);
    eventCounter = 0;
    setFraudResult(null);
    setEligibility(null);
    setOffers([]);
    setApplicationResult(null);
    setCredential(null);
    sessionIdRef.current = null;

    const body: Record<string, any> = {};
    if (options?.persona) body.persona = options.persona;
    if (options?.profile) body.profile = options.profile;

    // Show step 1 while TEE runs; minimum dwell so Connect phase is visible
    setStep(1);
    const [backendResult] = await Promise.all([
      callBackend("/api/demo/start", Object.keys(body).length > 0 ? body : undefined),
      delay(800),
    ]);

    if (backendResult?.success) {
      sessionIdRef.current = backendResult.sessionId ?? backendResult.result?.sessionId ?? null;
      if (backendResult.userDid) userDidRef.current = backendResult.userDid;
      else if (backendResult.result?.userDid) userDidRef.current = backendResult.result.userDid;
      await playLiveStartSequence(backendResult.result);
      setIsLoading(false);
      return;
    }

    // === SIMULATED MODE (fallback) ===
    // Resolve profile data for simulation
    const personas = {
      alice: { income: 150000, debt: 10000, nationality: "US", userDid: DEMO_USER_DIDS.alice, flagged: false },
      bob: { income: 45000, debt: 35000, nationality: "UK", userDid: DEMO_USER_DIDS.bob, flagged: true },
      charlie: { income: 52000, debt: 28000, nationality: "SG", userDid: DEMO_USER_DIDS.charlie, flagged: false },
    };

    let simIncome = 85000;
    let simDebt = 12000;
    let simNationality = "SG";
    let simUserDid: string = DEMO_USER_DIDS.alan;
    let simFlagged = false;

    if (options?.persona && personas[options.persona]) {
      const p = personas[options.persona];
      simIncome = p.income; simDebt = p.debt; simNationality = p.nationality;
      simUserDid = p.userDid; simFlagged = p.flagged;
    } else if (options?.profile) {
      simIncome = options.profile.annual_income;
      simDebt = options.profile.total_debt;
      simNationality = options.profile.nationality;
      simUserDid = DEMO_USER_DIDS.custom;
    }

    userDidRef.current = simUserDid;

    // Compute credit score locally for simulation
    const dti = simDebt / Math.max(simIncome, 1);
    let simScore = 850;
    if (dti > 0.5) simScore -= 300;
    else if (dti > 0.4) simScore -= 200;
    else if (dti > 0.3) simScore -= 120;
    else if (dti > 0.2) simScore -= 60;
    else if (dti > 0.1) simScore -= 20;
    if (simIncome >= 150000) simScore += 30;
    else if (simIncome >= 100000) simScore += 20;
    else if (simIncome >= 60000) simScore += 10;
    else if (simIncome < 30000) simScore -= 50;
    simScore = Math.max(300, Math.min(850, simScore));

    const simTier = simScore >= 750 ? "prime" : simScore >= 650 ? "near_prime" : "subprime";
    const simMaxLoan = simScore >= 750
      ? Math.min(simIncome * 4, 500000)
      : simScore >= 650
        ? Math.min(simIncome * 2.5, 200000)
        : Math.min(simIncome * 1, 50000);

    // Dynamic rate: base 4.0% + (850 - score) * 0.02%
    const dynamicBaseRate = Math.round((4.0 + (850 - simScore) * 0.02) * 100) / 100;

    // Step 1: Authentication
    setStep(1);
    addEvent({ type: "system", step: 1, title: "Initializing T3N Connection", content: "setEnvironment(\"testnet\")\nLoading WASM cryptographic component...", highlight: "blue" });
    await delay(800);

    addEvent({ type: "system", step: 1, title: "Agent Authentication", content: `await t3n.handshake()\nawait t3n.authenticate(createEthAuthInput(address))\n\nAgent DID: ${appEnv.agentDid}\n✓ Encrypted channel established (post-quantum)`, highlight: "blue" });
    await delay(600);

    if (options?.profile) {
      addEvent({ type: "system", step: 1, title: "🔒 Custom Data Sealed in T3N Vault", content: "User financial data encrypted with TEE public key.\nData stored in hardware-secured enclave.\nPrivaLend Agent has NO access to raw financial data.\n\nOnly the credit score output will be visible to the Agent.", highlight: "green" });
      await delay(600);
    }

    addEvent({ type: "agent_action", step: 1, title: "agent-auth-update (User Delegation)", content: JSON.stringify({
      agentDid: appEnv.agentDid,
      scripts: [{
        scriptName: privalendScriptName(),
        functions: ["assess-eligibility", "fetch-offers", "submit-application", "issue-credit-credential"],
        allowedHosts: ["localhost:4000"]
      }, {
        scriptName: fraudCheckScriptName(),
        functions: ["check-blacklist"],
        allowedHosts: []
      }]
    }, null, 2), highlight: "yellow" });
    await delay(1000);

    // Step 2: Cross-Tenant Fraud Check
    setStep(2);
    addEvent({ type: "cross_tenant", step: 2, title: "Cross-Tenant Call → Fraud Consortium", content: `executeBusinessContract(\n  "${fraudCheckScriptName()}",\n  "check-blacklist"\n)\nInput: { user_did: "${simUserDid}" }`, highlight: "yellow" });
    await delay(1200);

    if (simFlagged) {
      addEvent({ type: "tee_simulated", step: 2, title: "Inside Consortium Enclave", content: `📍 TEE Node: Intel TDX Secure Enclave\n\nLooking up ${simUserDid}\nin ${fraudCheckScriptName().slice(0, 14)}...:fraud_blacklist...\n\nBlacklist entries: 2\n⚠️ Match: FOUND\n\nReturning risk signal: CRITICAL`, highlight: "gray" });
      await delay(800);

      const fraud = { is_flagged: true, risk_level: "critical" };
      setFraudResult(fraud);
      addEvent({ type: "agent_received", step: 2, title: "Agent Received (Fraud Result)", content: JSON.stringify({ is_flagged: true, risk_level: "critical", checked_at: new Date().toISOString(), consortium_id: appEnv.consortiumDid }, null, 2), highlight: "red" });
      await delay(600);
      addEvent({ type: "error", step: 2, title: "Application Rejected — Fraud Blacklist", content: "User flagged in industry fraud blacklist.\nApplication terminated.\n\nThis demonstrates cross-tenant data sharing:\nThe Consortium reveals only a boolean signal,\nnot WHY the user was flagged.", highlight: "red" });

      setEligibility({ score: 0, tier: "rejected", max_loan_amount: 0, approved: false });
      setIsLoading(false);
      return;
    }

    addEvent({ type: "tee_simulated", step: 2, title: "Inside Consortium Enclave (Simulated)", content: `📍 TEE Node: Intel TDX Secure Enclave\n\nLooking up ${simUserDid}\nin ${fraudCheckScriptName().slice(0, 14)}...:fraud_blacklist...\n\nBlacklist entries: 2\nMatch: NOT FOUND ✓\n\n⚠️ Blacklist data never leaves this enclave.\nReturning risk signal only.`, highlight: "gray" });
    await delay(800);

    const fraud = { is_flagged: false, risk_level: "low" };
    setFraudResult(fraud);
      addEvent({ type: "agent_received", step: 2, title: "Agent Received (Fraud Result)", content: JSON.stringify({ is_flagged: false, risk_level: "low", checked_at: new Date().toISOString(), consortium_id: appEnv.consortiumDid }, null, 2), highlight: "green" });
    await delay(600);

    // Credit Assessment
    addEvent({ type: "agent_action", step: 2, title: "Credit Assessment Call", content: `executeAndDecode(\n  "${privalendScriptName()}",\n  "assess-eligibility"\n)\nInput: { fraud_result: { is_flagged: false }, loan_amount: 50000 }\n\n🔐 User financial data resolved inside TEE only.`, highlight: "blue" });
    await delay(1000);

    addEvent({ type: "tee_simulated", step: 2, title: "Inside PrivaLend Enclave", content: `📍 TEE Node: Intel TDX Secure Enclave\n\nFetching user financial profile from KV store...\n  → Annual Income: $${simIncome.toLocaleString()}\n  → Total Debt: $${simDebt.toLocaleString()}\n  → Nationality: ${simNationality}\n\nComputing credit score...\n  DTI Ratio: ${(dti * 100).toFixed(1)}%\n  Score: ${simScore} (${simTier.toUpperCase()})\n  Max Loan: $${Math.round(simMaxLoan).toLocaleString()}\n\n⚠️ Raw financial data destroyed in enclave memory.`, highlight: "gray" });
    await delay(800);

    const elig = { score: simScore, tier: simTier, max_loan_amount: Math.round(simMaxLoan), approved: simScore >= 550 };
    setEligibility(elig);
    addEvent({ type: "agent_received", step: 2, title: "Agent Received (Eligibility)", content: JSON.stringify({ score: simScore, tier: simTier, max_loan_amount: Math.round(simMaxLoan), debt_to_income_ratio: Math.round(dti * 1000) / 1000, approved: simScore >= 550 }, null, 2), highlight: "green" });
    await delay(600);

    // Step 3: Fetch Offers with dynamic pricing
    setStep(3);
    addEvent({ type: "agent_action", step: 3, title: "Fetching Loan Offers (Dynamic Pricing)", content: `executeAndDecode("${privalendScriptName()}", "fetch-offers")\nUsing http::call → Lender APIs\nInput: { tier: "${simTier}", score: ${simScore}, amount: 50000, term: 36 }\n\n📊 Dynamic Rate = 4.0% + (850 - ${simScore}) × 0.02% = ${dynamicBaseRate}%\n🔒 No PII sent in this request.`, highlight: "blue" });
    await delay(1000);

    function calcMonthly(principal: number, annualRate: number, months: number): number {
      const monthlyRate = annualRate / 100 / 12;
      if (monthlyRate === 0) return principal / months;
      const factor = Math.pow(1 + monthlyRate, months);
      return Math.round(((principal * monthlyRate * factor) / (factor - 1)) * 100) / 100;
    }

    const amount = 50000;
    const term = 36;
    const mockOffers: LoanOffer[] = [
      { id: "offer_dbs_003", lender: "DBS Bank", amount, interest_rate: Math.round((dynamicBaseRate - 0.2) * 100) / 100, term_months: term, monthly_payment: calcMonthly(amount, dynamicBaseRate - 0.2, term), total_cost: calcMonthly(amount, dynamicBaseRate - 0.2, term) * term, features: ["Lowest rate guarantee", "No early repayment penalty"] },
      { id: "offer_citi_001", lender: "CitiBank", amount, interest_rate: dynamicBaseRate, term_months: term, monthly_payment: calcMonthly(amount, dynamicBaseRate, term), total_cost: calcMonthly(amount, dynamicBaseRate, term) * term, features: ["No origination fee", "Rate lock 60 days"] },
      { id: "offer_chase_002", lender: "JPMorgan Chase", amount, interest_rate: Math.round((dynamicBaseRate + 0.3) * 100) / 100, term_months: term, monthly_payment: calcMonthly(amount, dynamicBaseRate + 0.3, term), total_cost: calcMonthly(amount, dynamicBaseRate + 0.3, term) * term, features: ["Cashback $500", "Flexible repayment"] },
    ];
    setOffers(mockOffers);

    addEvent({ type: "agent_received", step: 3, title: `3 Offers Retrieved (Base Rate: ${dynamicBaseRate}%)`, content: JSON.stringify(mockOffers.map(o => ({ id: o.id, lender: o.lender, rate: `${o.interest_rate}%`, monthly: `$${o.monthly_payment}` })), null, 2), highlight: "green" });
    setIsLoading(false);
  }, [addEvent, callBackend]);

  const selectOffer = useCallback(async (offerId: string) => {
    const selected = offers.find(o => o.id === offerId);
    if (!selected) return;

    setIsApplying(true);
    setSubmittingOfferId(offerId);
    setIsLoading(true);
    try {
      // Try real backend (stay on step 3 while submitting; uses start session)
      if (!sessionIdRef.current) {
        console.warn("[Workflow] No sessionId — apply may fail in Live mode");
      }
      const backendResult = await callBackend("/api/demo/apply", {
        selectedOfferId: offerId,
        sessionId: sessionIdRef.current,
      });
      if (backendResult?.success) {
        await playLiveApplySequence(backendResult.result);
        return;
      }

      // === SIMULATED MODE ===
      addEvent({ type: "placeholder_before", step: 3, title: "Agent Sends → http-with-placeholders", content: JSON.stringify({
        offer_id: offerId,
        loan_amount: 50000,
        term_months: 36,
        applicant: {
          full_name: "{{profile.first_name}} {{profile.last_name}}",
          email: "{{profile.verified_contacts.email.value}}",
          date_of_birth: "{{profile.date_of_birth}}",
          id_number: "{{profile.id_number}}",
          phone: "{{profile.verified_contacts.phone.value}}"
        }
      }, null, 2), highlight: "red" });
      await delay(1500);

      addEvent({ type: "tee_simulated", step: 3, title: "T3N Node Resolving Placeholders", content: "📍 Inside TEE — Resolving profile markers...\n\n  {{profile.first_name}}    → \"Alan\"\n  {{profile.last_name}}     → \"Turing\"\n  {{profile.email}}         → \"alan@example.com\"\n  {{profile.id_number}}     → \"S1234567A\"\n  {{profile.date_of_birth}} → \"1912-06-23\"\n\nSending resolved payload to bank...\nAgent NEVER sees these values.", highlight: "gray" });
      await delay(1200);

      addEvent({ type: "placeholder_after", step: 3, title: "Bank Received (PII Resolved)", content: JSON.stringify({
        offer_id: offerId,
        loan_amount: 50000,
        term_months: 36,
        applicant: {
          full_name: "Alan Turing",
          email: "alan@example.com",
          date_of_birth: "1912-06-23",
          id_number: "S1234567A",
          phone: "+65 9123 4567"
        }
      }, null, 2), highlight: "green" });
      await delay(800);

      // Step 4: Success
      setStep(4);
      const result = { status: "approved", reference: "PL-DBS-2026A7F", lender: selected.lender };
      setApplicationResult(result);

      addEvent({ type: "audit_log", step: 4, title: "Immutable Audit Trail (Merkle-backed)", content: `[${new Date().toISOString()}] Loan application complete\n\n  ┌─────────────────────────────────────────┐\n  │ Agent DID:  ${truncateDidForDisplay(appEnv.agentDid).padEnd(28)}│\n  │ User DID:   ${userDidRef.current.slice(0, 28).padEnd(28)}│\n  │ Lender:     ${selected.lender.padEnd(28)}│\n  │ Amount:     $50,000                     │\n  │ Reference:  PL-DBS-2026A7F              │\n  ├─────────────────────────────────────────┤\n  │ PII Exposure to Agent: 0 bytes   ✓      │\n  │ Cross-Tenant Calls:    1 (Consortium)   │\n  │ Placeholder Fields:    5 resolved       │\n  │ Fraud Check:           PASSED           │\n  └─────────────────────────────────────────┘`, highlight: "blue" });
      await delay(600);

      const vcResult = buildDemoCredential({
        userDid: userDidRef.current,
        score: eligibility?.score ?? 780,
        tier: eligibility?.tier ?? "prime",
        maxLoanAmount: eligibility?.max_loan_amount ?? 150000,
        reference: result.reference,
      });
      setCredential(vcResult);

      addEvent({
        type: "vc_issued",
        step: 4,
        title: "🪪 Verifiable Credit Credential [DEMO MODE]",
        content: JSON.stringify(vcResult.credential, null, 2),
        highlight: "yellow",
      });
    } finally {
      setIsApplying(false);
      setSubmittingOfferId(null);
      setIsLoading(false);
    }
  }, [offers, addEvent, callBackend, eligibility]);

  const reset = useCallback(() => {
    clearWalletDemoStorage();
    sessionIdRef.current = null;
    setStep(0);
    setIsLoading(false);
    setIsApplying(false);
    setSubmittingOfferId(null);
    setEvents([]);
    setFraudResult(null);
    setEligibility(null);
    setOffers([]);
    setApplicationResult(null);
    setCredential(null);
    eventCounter = 0;
  }, []);

  return { step, isLoading, isApplying, submittingOfferId, events, fraudResult, eligibility, offers, applicationResult, credential, connected, startWorkflow, selectOffer, reset };
}
