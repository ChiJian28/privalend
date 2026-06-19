export const PRIVALEND_ISSUER_DID = "did:t3n:6ec1a64ea7733c6b8e87327db829dfae0648a197";

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

function hashSeed(seed: string, len: number): string {
  let hash = "";
  for (let i = 0; i < len; i++) {
    const charCode = (seed.charCodeAt(i % seed.length) * 31 + i * 17) % 16;
    hash += charCode.toString(16);
  }
  return hash;
}

export function buildDemoCredential(input: {
  userDid: string;
  score: number;
  tier: string;
  maxLoanAmount: number;
  reference: string;
}): CredentialIssueResult {
  const issuanceDate = new Date().toISOString();
  const expirationDate = addMonths(issuanceDate, 12);
  const tierLabel = tierDisplay(input.tier, input.score);
  const proofSeed = `${input.reference}:${input.userDid}:${input.score}:${issuanceDate}`;

  return {
    mode: "demo",
    issuedInsideTee: false,
    credential: {
      "@context": [
        "https://www.w3.org/2018/credentials/v1",
        "https://privalend.demo/schemas/credit/v1",
      ],
      id: `https://privalend.demo/credentials/${input.reference}`,
      type: ["VerifiableCredential", "CreditTierCredential"],
      issuer: PRIVALEND_ISSUER_DID,
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
        verificationMethod: `${PRIVALEND_ISSUER_DID}#keys-1`,
        proofValue: "z" + hashSeed(proofSeed, 43),
        jws: btoa(JSON.stringify({ alg: "ES256", demo: proofSeed.slice(0, 16) })),
        pending: "Demo signature — awaiting T3N sign-sd-jwt-vc on testnet",
      },
    },
  };
}

export function truncateDid(did: string, head = 12, tail = 6): string {
  if (did.length <= head + tail + 3) return did;
  return `${did.slice(0, head)}...${did.slice(-tail)}`;
}

export function walletStorageKey(reference: string): string {
  return `privalend_vc_${reference}`;
}

/** Clear demo wallet keys so each workflow run can interact with Save again. */
export function clearWalletDemoStorage(): void {
  if (typeof window === "undefined") return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("privalend_vc_")) keysToRemove.push(key);
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}
