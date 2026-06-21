import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";
export type InspectorEventType = "system" | "agent_action" | "agent_received" | "tee_simulated" | "tee_log" | "placeholder_before" | "placeholder_after" | "cross_tenant" | "audit_log" | "vc_issued" | "error";
export interface InspectorEvent {
    type: InspectorEventType;
    timestamp: number;
    step: number;
    title: string;
    content: string;
    highlight?: "red" | "green" | "yellow" | "blue" | "gray";
}
export declare function initWebSocket(server: HttpServer): SocketIOServer;
export declare function emitInspectorEvent(event: Omit<InspectorEvent, "timestamp">): void;
