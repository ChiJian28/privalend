import { Server as SocketIOServer } from "socket.io";
let io = null;
export function initWebSocket(server) {
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
export function emitInspectorEvent(event) {
    const fullEvent = { ...event, timestamp: Date.now() };
    if (io) {
        io.emit("inspector_event", fullEvent);
    }
    const prefix = getPrefix(event.type);
    console.log(`${prefix} [Step ${event.step}] ${event.title}: ${event.content.slice(0, 100)}`);
}
function getPrefix(type) {
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
        case "vc_issued": return "🪪";
        case "error": return "❌";
    }
}
