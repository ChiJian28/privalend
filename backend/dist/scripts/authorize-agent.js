/**
 * Agent Authorization Script
 *
 * This script simulates the USER (data owner) authorizing the PrivaLend agent
 * to access their data and call specific TEE contracts on their behalf.
 *
 * In production, this would be done through the user's wallet/app.
 * For the hackathon demo, we pre-authorize the agent.
 *
 * Run after setup:tenants has completed.
 */
import { T3nClient, loadWasmComponent, eth_get_address, metamask_sign, createEthAuthInput, setEnvironment, getScriptVersion, getNodeUrl, } from "@terminal3/t3n-sdk";
import { config } from "../config.js";
async function main() {
    console.log("\n🔑 PrivaLend — Agent Authorization Script");
    console.log("==========================================\n");
    setEnvironment(config.t3n.environment);
    // The USER authenticates (this is the data owner)
    // For demo, we use the privalend key as the "user" as well
    const userKey = config.privalend.apiKey;
    const wasmComponent = await loadWasmComponent();
    const userAddress = eth_get_address(userKey);
    const userClient = new T3nClient({
        wasmComponent,
        handlers: {
            EthSign: metamask_sign(userAddress, undefined, userKey),
        },
    });
    await userClient.handshake();
    const userDid = await userClient.authenticate(createEthAuthInput(userAddress));
    console.log(`  User DID: ${userDid.value}`);
    // Get agent DID
    const agentDid = config.agent.did || "did:t3n:agent_placeholder";
    console.log(`  Agent DID: ${agentDid}`);
    // Build contract references
    const privalendTenantId = config.privalend.did.slice("did:t3n:".length);
    const consortiumTenantId = config.consortium.did?.slice("did:t3n:".length) || "consortium_placeholder";
    const PRIVALEND_SCRIPT = `z:${privalendTenantId}:privalend`;
    const CONSORTIUM_SCRIPT = `z:${consortiumTenantId}:fraud-check`;
    // Get user/contracts script version for agent-auth-update
    const userContractVersion = await getScriptVersion(getNodeUrl(), "tee:user/contracts");
    console.log(`\n  Authorizing agent to call:`);
    console.log(`    - ${PRIVALEND_SCRIPT} [assess-eligibility, fetch-offers, submit-application, issue-credit-credential]`);
    console.log(`    - ${CONSORTIUM_SCRIPT} [check-blacklist]`);
    console.log(`    - Allowed hosts: [localhost:4000]\n`);
    // Submit agent-auth-update (signed by the USER)
    const privalendVersion = await getScriptVersion(getNodeUrl(), PRIVALEND_SCRIPT);
    const consortiumVersion = await getScriptVersion(getNodeUrl(), CONSORTIUM_SCRIPT);
    await userClient.execute({
        script_name: "tee:user/contracts",
        script_version: userContractVersion,
        function_name: "agent-auth-update",
        input: {
            agents: [{
                    agentDid: agentDid,
                    scripts: [
                        {
                            scriptName: PRIVALEND_SCRIPT,
                            versionReq: privalendVersion,
                            functions: ["assess-eligibility", "fetch-offers", "submit-application", "issue-credit-credential"],
                            allowedHosts: ["localhost:4000"],
                        },
                        {
                            scriptName: CONSORTIUM_SCRIPT,
                            versionReq: consortiumVersion,
                            functions: ["check-blacklist"],
                            allowedHosts: [],
                        },
                    ],
                }],
        },
    });
    console.log("  ✅ Agent authorization submitted successfully!");
    console.log("  The agent can now act on behalf of this user.\n");
    console.log("==========================================\n");
}
main().catch((err) => {
    console.error("\n❌ Authorization failed:", err.message || err);
    process.exit(1);
});
