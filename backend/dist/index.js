import { createRequire } from "node:module";
import cors from "cors";
import { createServer } from "http";
import { config } from "./config.js";
import { initWebSocket } from "./websocket.js";
import { createApiRouter } from "./routes/api.js";
import { startMockBankServer } from "./mock-bank/server.js";
import { setupPrivaLendTenant, setupConsortiumTenant } from "./t3n/tenant-setup.js";
const require = createRequire(import.meta.url);
const express = require("express");
const app = express();
app.use(cors());
app.use(express.json());
const server = createServer(app);
initWebSocket(server);
let privalendDeployment = null;
let consortiumDeployment = null;
// Health check
app.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        service: "privalend-backend",
        tenants: {
            privalend: !!privalendDeployment,
            consortium: !!consortiumDeployment,
        },
    });
});
async function main() {
    await startMockBankServer();
    // Auto-connect to already-deployed contracts on T3N testnet
    console.log("\n[Boot] Connecting to deployed contracts on T3N testnet...");
    console.log(`[Boot] Runtime: NODE_ENV=${process.env.NODE_ENV ?? "unset"}, RENDER=${process.env.RENDER ?? "unset"}`);
    try {
        privalendDeployment = await setupPrivaLendTenant();
        console.log(`[Boot] ✅ PrivaLend connected: ${privalendDeployment.scriptName} (id: ${privalendDeployment.contractId})`);
    }
    catch (err) {
        console.log(`[Boot] ⚠️  PrivaLend setup failed: ${err.message}`);
    }
    try {
        consortiumDeployment = await setupConsortiumTenant();
        console.log(`[Boot] ✅ Consortium connected: ${consortiumDeployment.scriptName} (id: ${consortiumDeployment.contractId})`);
    }
    catch (err) {
        console.log(`[Boot] ⚠️  Consortium setup failed: ${err.message}`);
    }
    // Mount API routes AFTER tenants are loaded
    app.use("/api", createApiRouter(privalendDeployment, consortiumDeployment));
    server.listen(config.server.port, () => {
        console.log(`\n====================================`);
        console.log(`  PrivaLend Backend Server`);
        console.log(`====================================`);
        console.log(`  Main API:    http://localhost:${config.server.port}`);
        console.log(`  Mock Bank:   http://localhost:${config.mockBank.port}`);
        console.log(`  WebSocket:   ws://localhost:${config.server.port}`);
        console.log(`  Tenants:     ${privalendDeployment ? "✅" : "❌"} PrivaLend | ${consortiumDeployment ? "✅" : "❌"} Consortium`);
        console.log(`====================================\n`);
    });
}
main().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
});
