import type { TenantDeployment } from "./tenant-setup.js";
import type { createAgentClient } from "./client.js";
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
export declare function buildDemoCredential(input: CreditCredentialInput): CreditCredential;
/** VC issuance uses privalend v0.2.1+ (issue-credit-credential, no logging host). */
export declare const VC_CONTRACT_VERSION = "0.2.1";
export declare function issueCreditCredential(input: CreditCredentialInput, privalend: TenantDeployment, agent: AgentClient, step?: number): Promise<CredentialIssueResult>;
export {};
