import type { TenantDeployment } from "./tenant-setup.js";
import { type CredentialIssueResult } from "./issue-credential.js";
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
    userDid?: string;
    sessionId?: string;
    fraudCheck: {
        is_flagged: boolean;
        risk_level: string;
    };
    eligibility: {
        score: number;
        tier: string;
        max_loan_amount: number;
    };
    offers: LoanOffer[];
    applicationResult?: {
        status: string;
        reference: string;
        lender: string;
    };
    credential?: CredentialIssueResult;
}
export interface ProfileInput {
    annual_income: number;
    total_debt: number;
    nationality: string;
}
/**
 * Apply phase only — submit selected offer + issue VC using an existing start session.
 * Does NOT re-run fraud check, eligibility, or fetch-offers.
 */
export declare function runApplicationPhase(userDid: string, loanRequest: {
    amount: number;
    termMonths: number;
    purpose: string;
}, eligibility: {
    score: number;
    tier: string;
    max_loan_amount: number;
}, selectedOfferId: string, offers: LoanOffer[], privalend: TenantDeployment, _consortium: TenantDeployment): Promise<WorkflowResult>;
/**
 * Main agent workflow: the AI agent orchestrates the loan application
 * without ever seeing user PII.
 *
 * If a custom profile is provided, it is first sealed into T3N KV store
 * (bypassing the Agent), then the Agent calls TEE contracts which read
 * from KV store internally — full TEE execution path.
 */
export declare function runAgentWorkflow(userDid: string, loanRequest: {
    amount: number;
    termMonths: number;
    purpose: string;
}, privalend: TenantDeployment, consortium: TenantDeployment, selectedOfferId?: string, profileInput?: ProfileInput, isFlagged?: boolean): Promise<WorkflowResult>;
