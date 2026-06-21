import type { LoanOffer } from "./agent-workflow.js";
export interface WorkflowSession {
    userDid: string;
    loanRequest: {
        amount: number;
        termMonths: number;
        purpose: string;
    };
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
    createdAt: number;
}
export declare function createWorkflowSession(data: Omit<WorkflowSession, "createdAt">): string;
export declare function getWorkflowSession(sessionId: string): WorkflowSession | undefined;
export declare function consumeWorkflowSession(sessionId: string): WorkflowSession | undefined;
