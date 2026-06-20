import { randomUUID } from "crypto";
import type { LoanOffer } from "./agent-workflow.js";

export interface WorkflowSession {
  userDid: string;
  loanRequest: { amount: number; termMonths: number; purpose: string };
  fraudCheck: { is_flagged: boolean; risk_level: string };
  eligibility: { score: number; tier: string; max_loan_amount: number };
  offers: LoanOffer[];
  createdAt: number;
}

const sessions = new Map<string, WorkflowSession>();
const TTL_MS = 60 * 60 * 1000;

function pruneExpired(): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > TTL_MS) sessions.delete(id);
  }
}

export function createWorkflowSession(data: Omit<WorkflowSession, "createdAt">): string {
  pruneExpired();
  const id = randomUUID();
  sessions.set(id, { ...data, createdAt: Date.now() });
  return id;
}

export function getWorkflowSession(sessionId: string): WorkflowSession | undefined {
  pruneExpired();
  return sessions.get(sessionId);
}

export function consumeWorkflowSession(sessionId: string): WorkflowSession | undefined {
  const session = getWorkflowSession(sessionId);
  if (session) sessions.delete(sessionId);
  return session;
}
