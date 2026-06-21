import { randomUUID } from "crypto";
const sessions = new Map();
const TTL_MS = 60 * 60 * 1000;
function pruneExpired() {
    const now = Date.now();
    for (const [id, session] of sessions) {
        if (now - session.createdAt > TTL_MS)
            sessions.delete(id);
    }
}
export function createWorkflowSession(data) {
    pruneExpired();
    const id = randomUUID();
    sessions.set(id, { ...data, createdAt: Date.now() });
    return id;
}
export function getWorkflowSession(sessionId) {
    pruneExpired();
    return sessions.get(sessionId);
}
export function consumeWorkflowSession(sessionId) {
    const session = getWorkflowSession(sessionId);
    if (session)
        sessions.delete(sessionId);
    return session;
}
