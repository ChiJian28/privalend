import { createHash } from "crypto";
import { emitInspectorEvent } from "../websocket.js";
import type { TenantDeployment } from "./tenant-setup.js";
import type { createAgentClient } from "./client.js";

export const PRIVALEND_ISSUER_DID = "did:t3n:8b5e0d443d68570f4800da31e46d1581d603b8db";

export interface CreditCredentialProof {
  type: string;
  created: string;
  proofPurpose: string;
  verificationMethod: string;
  proofValue: string;
  jws?: string;
  pending?: string;
}

export interface CreditCredential {
  "@context": string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  expirationDate: string;
  credentialSubject: {
    id: string;
    creditTier: string;
    creditScore: number;
    maxLoanAmount: number;
    assessmentMethod: string;
    teeAttestation: string;
    loanReference: string;
  };
  proof: CreditCredentialProof;
}

export interface CredentialIssueResult {
  mode: "tee" | "demo";
  credential: CreditCredential;
  issuedInsideTee: boolean;
}

export interface CreditCredentialInput {
  userDid: string;
  score: number;
  tier: string;
  maxLoanAmount: number;
  reference: string;
  issuerDid?: string;
}

type AgentClient = Awaited<ReturnType<typeof createAgentClient>>;

function tierDisplay(tier: string, score: number): string {
  switch (tier.toLowerCase()) {
    case "prime":
      return "A+";
    case "near_prime":
      return "B+";
    case "subprime":
      return "C";
    default:
      if (score >= 750) return "A+";
      if (score >= 650) return "B+";
      return tier.toUpperCase();
  }
}

function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

function generateProofValue(seed: string): string {
  return "z" + createHash("sha256").update(seed).digest("base64url").slice(0, 43);
}

function generateDemoJws(seed: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "ES256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iss: PRIVALEND_ISSUER_DID, vc: seed.slice(0, 16) })).toString("base64url");
  const sig = createHash("sha256").update(seed + "jws").digest("base64url");
  return `${header}.${payload}.${sig}`;
}

export function buildDemoCredential(input: CreditCredentialInput): CreditCredential {
  const issuerDid = input.issuerDid ?? PRIVALEND_ISSUER_DID;
  const issuanceDate = new Date().toISOString();
  const expirationDate = addMonths(issuanceDate, 12);
  const tierLabel = tierDisplay(input.tier, input.score);
  const vcId = `https://privalend.demo/credentials/${input.reference}`;
  const proofSeed = `${input.reference}:${input.userDid}:${input.score}:${issuanceDate}`;

  return {
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://privalend.demo/schemas/credit/v1",
    ],
    id: vcId,
    type: ["VerifiableCredential", "CreditTierCredential"],
    issuer: issuerDid,
    issuanceDate,
    expirationDate,
    credentialSubject: {
      id: input.userDid,
      creditTier: tierLabel,
      creditScore: input.score,
      maxLoanAmount: input.maxLoanAmount,
      assessmentMethod: "TEE-confidential-computation",
      teeAttestation: "Intel-TDX",
      loanReference: input.reference,
    },
    proof: {
      type: "Ed25519Signature2020",
      created: issuanceDate,
      proofPurpose: "assertionMethod",
      verificationMethod: `${issuerDid}#keys-1`,
      proofValue: generateProofValue(proofSeed),
      jws: generateDemoJws(proofSeed),
      pending: "Demo signature — awaiting T3N sign-sd-jwt-vc on testnet",
    },
  };
}

/** VC issuance uses privalend v0.2.1+ (issue-credit-credential, no logging host). */
export const VC_CONTRACT_VERSION = "0.2.1";

async function tryTeeIssueCredential(
  input: CreditCredentialInput,
  privalend: TenantDeployment,
  agent: AgentClient
): Promise<CredentialIssueResult | null> {
  const issuerDid = input.issuerDid ?? privalend.auth.did;
  const issuanceDate = new Date().toISOString();
  const expirationDate = addMonths(issuanceDate, 12);

  const teeInput = {
    user_did: input.userDid,
    score: input.score,
    tier: input.tier,
    max_loan_amount: input.maxLoanAmount,
    reference: input.reference,
    issuer_did: issuerDid,
    issued_at: issuanceDate,
    expires_at: expirationDate,
  };

  const versionsToTry = [VC_CONTRACT_VERSION, privalend.scriptVersion]
    .filter((v, i, arr) => arr.indexOf(v) === i);

  for (const version of versionsToTry) {
    try {
      const teeOutput = await agent.client.executeAndDecode({
        script_name: privalend.scriptName,
        script_version: version,
        function_name: "issue-credit-credential",
        input: teeInput,
      }) as { credential: CreditCredential; mode?: string; issued_inside_tee?: boolean };

      if (!teeOutput?.credential) continue;

      return {
        mode: "tee",
        credential: teeOutput.credential,
        issuedInsideTee: teeOutput.issued_inside_tee ?? true,
      };
    } catch (e: any) {
      console.log(`[VC] TEE v${version} unavailable (${e.message?.slice(0, 100)})`);
    }
  }

  return null;
}

export async function issueCreditCredential(
  input: CreditCredentialInput,
  privalend: TenantDeployment,
  agent: AgentClient,
  step = 4
): Promise<CredentialIssueResult> {
  emitInspectorEvent({
    type: "system",
    step,
    title: "🪪 Issuing Verifiable Credit Credential",
    content: `Attempting TEE issuance via issue-credit-credential...\nSubject: ${input.userDid}\nScore: ${input.score} | Tier: ${tierDisplay(input.tier, input.score)}\nReference: ${input.reference}`,
    highlight: "blue",
  });

  const teeResult = await tryTeeIssueCredential(input, privalend, agent);

  if (teeResult) {
    emitVcInspectorEvent(teeResult, step);
    return teeResult;
  }

  const demoResult: CredentialIssueResult = {
    mode: "demo",
    credential: buildDemoCredential(input),
    issuedInsideTee: false,
  };

  emitVcInspectorEvent(demoResult, step);
  return demoResult;
}

function emitVcInspectorEvent(result: CredentialIssueResult, step: number): void {
  const badge = result.mode === "tee" ? "TEE-ISSUED" : "DEMO MODE";
  emitInspectorEvent({
    type: "vc_issued",
    step,
    title: `🪪 Verifiable Credit Credential [${badge}]`,
    content: JSON.stringify(result.credential, null, 2),
    highlight: result.mode === "tee" ? "green" : "yellow",
  });
}
