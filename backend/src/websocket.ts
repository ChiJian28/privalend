import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";

export type InspectorEventType =
  | "system"
  | "agent_action"
  | "agent_received"
  | "tee_simulated"
  | "tee_log"
  | "placeholder_before"
  | "placeholder_after"
  | "cross_tenant"
  | "audit_log"
  | "error";

export interface InspectorEvent {
  type: InspectorEventType;
  timestamp: number;
  step: number;
  title: string;
  content: string;
  highlight?: "red" | "green" | "yellow" | "blue" | "gray";
}

let io: SocketIOServer | null = null;

export function initWebSocket(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  io.on("connection", (socket) => {
    console.log(`[WS] Inspector client connected: ${socket.id}`);
    socket.on("disconnect", () => {
      console.log(`[WS] Inspector client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function emitInspectorEvent(event: Omit<InspectorEvent, "timestamp">) {
  const fullEvent: InspectorEvent = { ...event, timestamp: Date.now() };

  if (io) {
    io.emit("inspector_event", fullEvent);
  }

  const prefix = getPrefix(event.type);
  console.log(`${prefix} [Step ${event.step}] ${event.title}: ${event.content.slice(0, 100)}`);
}

function getPrefix(type: InspectorEventType): string {
  switch (type) {
    case "system": return "⚙️";
    case "agent_action": return "🤖";
    case "agent_received": return "📥";
    case "tee_simulated": return "🔒";
    case "tee_log": return "📡";
    case "placeholder_before": return "📤";
    case "placeholder_after": return "✅";
    case "cross_tenant": return "🔗";
    case "audit_log": return "📋";
    case "error": return "❌";
  }
}
