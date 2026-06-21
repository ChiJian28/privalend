/**
 * PrivaLend has exactly ONE AI agent: PrivaLend Agent (orchestrator).
 * Six parties on the graph: User, KV Vault, Agent, TEE, Fraud Consortium, Lender.
 */
export type PartyId =
  | "user"
  | "vault"
  | "agent"
  | "tee"
  | "fraud"
  | "lender";

export type FlowId =
  | "user_agent"      // blue — User ↗ Agent (intent / authorization)
  | "user_vault"      // green — User ↘ Vault (data sealing, bypasses Agent)
  | "agent_tee"       // blue — Agent ⬇ TEE (commands)
  | "tee_agent"       // blue — TEE ↑ Agent (desensitized score)
  | "tee_vault"       // cyan — TEE ↙ Vault (enclave read)
  | "agent_fraud"     // yellow — Agent ↘ Fraud (cross-tenant check)
  | "tee_lender"      // green/gold — TEE → Lender (safe output)
  | "agent_vault";    // red — rogue attack

export type ChoreographyPhase =
  | "idle"
  | "sealing"        // Step 1 — User ↘ Vault (bypass Agent)
  | "fraud_check"    // Step 2a — User → Agent → Fraud Consortium
  | "tee_compute"    // Step 2b — Agent → TEE ↔ Vault, score return
  | "rejected"       // Fraud blacklist hit — workflow frozen
  | "offers_wait"    // Step 3 — idle, awaiting human offer selection
  | "apply"          // Step 3→4 — User authorizes, TEE resolves PII → Lender
  | "success"        // Step 4 — workflow closed, VC issued
  | "attack";

export type AttackAnimPhase = "idle" | "strike" | "pulse" | "shield" | "shatter" | "safe";

export interface ChoreographyContext {
  eligibility?: { score: number } | null;
}

export const PARTY_META: Record<PartyId, { emoji: string; label: string; sub: string }> = {
  user: { emoji: "👤", label: "User Client", sub: "Request origin" },
  vault: { emoji: "🗄️", label: "T3N KV Vault", sub: "eligibility-cache" },
  agent: { emoji: "🤖", label: "PrivaLend Agent", sub: "AI Orchestrator ×1" },
  tee: { emoji: "🛡️", label: "Intel TDX Enclave", sub: "T3N TEE compute" },
  fraud: { emoji: "🔗", label: "Fraud Consortium", sub: "Tenant B contract" },
  lender: { emoji: "🏦", label: "Lender APIs", sub: "Bank endpoint" },
};

export const PHASE_STATUS: Record<ChoreographyPhase, string> = {
  idle: "Select persona and execute workflow",
  sealing: "Sealing PII in T3N KV Vault...",
  fraud_check: "Cross-tenant fraud blacklist screening...",
  tee_compute: "TEE computing credit score inside enclave...",
  rejected: "⛔ Application rejected — fraud blacklist match",
  offers_wait: "Awaiting your offer selection — agent idle",
  apply: "Resolving {{profile.*}} placeholders in TEE...",
  success: "Workflow complete — VC issued",
  attack: "🚨 TEE OVERRIDE — Agent behavior hijacked",
};

export function isFraudRejected(
  fraudResult: { is_flagged: boolean } | null,
): boolean {
  return fraudResult?.is_flagged === true;
}

export function deriveChoreographyPhase(
  step: number,
  isLoading: boolean,
  fraudResult: { is_flagged: boolean } | null,
  eligibility: { score: number } | null,
  maliciousMode: boolean,
  isApplying = false,
): ChoreographyPhase {
  // Visual graph attack override only — does not block useWorkflow async sequence
  if (maliciousMode) return "attack";
  if (step === 0) return "idle";

  if (isFraudRejected(fraudResult) && step >= 2) return "rejected";

  if (step === 1) return isLoading ? "sealing" : "fraud_check";
  if (step === 2) {
    if (!fraudResult) return "fraud_check";
    return "tee_compute";
  }
  if (step === 3) return isApplying ? "apply" : "offers_wait";
  if (step === 4) return "success";
  return "idle";
}

/** Animated flows (liquid). Rejected uses frozenFlows instead. */
export function activeFlows(phase: ChoreographyPhase, ctx: ChoreographyContext = {}): FlowId[] {
  switch (phase) {
    case "sealing": return ["user_vault"];
    case "fraud_check": return ["user_agent", "agent_fraud"];
    case "tee_compute": {
      const flows: FlowId[] = ["agent_tee", "tee_vault"];
      if (ctx.eligibility) flows.push("tee_agent");
      return flows;
    }
    case "apply": return ["user_agent", "agent_tee", "tee_lender"];
    case "attack": return ["agent_vault"];
    default: return [];
  }
}

/** Static red lines when fraud rejects — no liquid animation. */
export function frozenFlows(phase: ChoreographyPhase): FlowId[] {
  if (phase === "rejected") return ["user_agent", "agent_fraud"];
  return [];
}

export function glowingParties(phase: ChoreographyPhase): PartyId[] {
  switch (phase) {
    case "sealing": return ["user", "vault"];
    case "fraud_check": return ["user", "agent", "fraud"];
    case "tee_compute": return ["agent", "tee", "vault"];
    case "rejected": return ["user", "agent", "fraud"];
    case "offers_wait": return ["user"];
    case "apply": return ["user", "agent", "tee", "lender"];
    case "success": return ["tee"];
    case "attack": return ["agent", "vault", "tee"];
    default: return [];
  }
}
