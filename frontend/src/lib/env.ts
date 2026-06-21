/** Public frontend config — required via NEXT_PUBLIC_* in frontend/.env.local */

function requirePublicEnv(value: string | undefined, name: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(
      `Missing ${name}. Copy frontend/.env.example to frontend/.env.local and set values to match backend/.env.`,
    );
  }
  return trimmed;
}

// Must use static process.env.NEXT_PUBLIC_* access — dynamic process.env[key] is not inlined for the browser bundle.
export const appEnv = {
  backendUrl: requirePublicEnv(process.env.NEXT_PUBLIC_BACKEND_URL, "NEXT_PUBLIC_BACKEND_URL"),
  agentDid: requirePublicEnv(process.env.NEXT_PUBLIC_AGENT_DID, "NEXT_PUBLIC_AGENT_DID"),
  privalendDid: requirePublicEnv(process.env.NEXT_PUBLIC_PRIVALEND_DID, "NEXT_PUBLIC_PRIVALEND_DID"),
  consortiumDid: requirePublicEnv(process.env.NEXT_PUBLIC_CONSORTIUM_DID, "NEXT_PUBLIC_CONSORTIUM_DID"),
};

export function tenantHex(did: string): string {
  return did.replace(/^did:t3n:/, "");
}

export function privalendScriptName(): string {
  return `z:${tenantHex(appEnv.privalendDid)}:privalend`;
}

export function fraudCheckScriptName(): string {
  return `z:${tenantHex(appEnv.consortiumDid)}:fraud-check`;
}

export function truncateDidForDisplay(did: string, head = 18): string {
  if (did.length <= head + 4) return did;
  return `${did.slice(0, head)}...`;
}

/** Fictional demo user DIDs — aligned with backend persona routes, not deployment secrets. */
export const DEMO_USER_DIDS = {
  alan: "did:t3n:demo_user_alan_turing",
  alice: "did:t3n:demo_user_alice",
  bob: "did:t3n:demo_user_bob_flagged",
  charlie: "did:t3n:demo_user_charlie",
  custom: "did:t3n:custom_user",
} as const;
