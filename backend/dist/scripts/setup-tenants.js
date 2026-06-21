/**
 * Setup script: Deploy both tenants (PrivaLend + Fraud Consortium) to T3N testnet.
 *
 * Prerequisites:
 * 1. Both Rust contracts must be compiled (see contracts/README.md)
 * 2. .env must have valid API keys for both tenants
 * 3. Both accounts must have test tokens claimed
 *
 * Run: npm run setup:tenants
 */
import { setupPrivaLendTenant, setupConsortiumTenant } from "../t3n/tenant-setup.js";
import { config } from "../config.js";
import { createAgentClient } from "../t3n/client.js";
async function main() {
    console.log("\n🚀 PrivaLend — Tenant Setup Script");
    console.log("===================================\n");
    // Validate env
    if (!config.privalend.apiKey || config.privalend.apiKey === "your_key_here") {
        throw new Error("PRIVALEND_API_KEY not set in .env");
    }
    if (!config.consortium.apiKey || config.consortium.apiKey.includes("your_")) {
        throw new Error("CONSORTIUM_API_KEY not set in .env — claim a second key from T3N");
    }
    // 1. Setup PrivaLend tenant
    console.log("📦 [1/3] Setting up PrivaLend tenant...\n");
    const privalend = await setupPrivaLendTenant();
    console.log(`✅ PrivaLend deployed: ${privalend.scriptName} (id: ${privalend.contractId})\n`);
    // 2. Setup Fraud Consortium tenant
    console.log("📦 [2/3] Setting up Fraud Consortium tenant...\n");
    const consortium = await setupConsortiumTenant();
    console.log(`✅ Consortium deployed: ${consortium.scriptName} (id: ${consortium.contractId})\n`);
    // 3. Setup Agent auth (user delegates to agent)
    console.log("🔑 [3/3] Setting up Agent authorization...\n");
    if (config.agent.apiKey && !config.agent.apiKey.includes("your_")) {
        const agent = await createAgentClient(config.agent.apiKey);
        console.log(`  Agent DID: ${agent.did}`);
        // The user would authorize the agent via agent-auth-update
        // In a real flow, this is done by the USER's client, not the agent itself
        console.log(`  ℹ️  In production, the user would run agent-auth-update to authorize this agent.`);
        console.log(`  ℹ️  For demo, the agent is pre-authorized.\n`);
    }
    else {
        console.log("  ⚠️  AGENT_API_KEY not set — skipping agent setup.");
        console.log("  ℹ️  Claim a third key from T3N for the agent identity.\n");
    }
    // Summary
    console.log("===================================");
    console.log("✅ Setup Complete!\n");
    console.log("Deployment Summary:");
    console.log(`  PrivaLend Script:    ${privalend.scriptName}`);
    console.log(`  PrivaLend Contract:  #${privalend.contractId}`);
    console.log(`  Consortium Script:   ${consortium.scriptName}`);
    console.log(`  Consortium Contract: #${consortium.contractId}`);
    console.log(`\nNext steps:`);
    console.log(`  1. Run 'npm run dev' to start the server`);
    console.log(`  2. Or 'npm run demo' for a full demonstration`);
    console.log("===================================\n");
}
main().catch((err) => {
    console.error("\n❌ Setup failed:", err.message || err);
    process.exit(1);
});
