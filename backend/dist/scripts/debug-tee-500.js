/**
 * Deep debug for T3N HTTP 500 on contract execution
 */
import { setEnvironment, getNodeUrl, getScriptVersion, loadWasmComponent, eth_get_address, metamask_sign, createEthAuthInput, T3nClient, } from "@terminal3/t3n-sdk";
import { config } from "../config.js";
import { setupPrivaLendTenant, setupConsortiumTenant } from "../t3n/tenant-setup.js";
async function probe(label, fn) {
    console.log(`\n--- ${label} ---`);
    try {
        await fn();
    }
    catch (e) {
        console.error("FAIL:", e.message || e);
        if (e.data)
            console.error("  data:", JSON.stringify(e.data));
        if (e.code)
            console.error("  code:", e.code);
    }
}
async function main() {
    setEnvironment(config.t3n.environment);
    const nodeUrl = getNodeUrl();
    console.log("Node URL:", nodeUrl);
    const privalend = await setupPrivaLendTenant();
    const consortium = await setupConsortiumTenant();
    await probe("tenant.me() — PrivaLend", async () => {
        const me = await privalend.auth.tenantClient.tenant.me();
        console.log(JSON.stringify(me, null, 2));
    });
    await probe("getScriptVersion privalend", async () => {
        const v = await getScriptVersion(nodeUrl, privalend.scriptName);
        console.log(`version=${v} typeof=${typeof v}`);
        console.log(`deployment.scriptVersion=${privalend.scriptVersion} typeof=${typeof privalend.scriptVersion}`);
    });
    await probe("GET /api/contracts/current", async () => {
        const res = await fetch(`${nodeUrl}/api/contracts/current?name=${encodeURIComponent(privalend.scriptName)}`);
        console.log("status:", res.status, await res.text());
    });
    await probe("contracts.enable(privalend)", async () => {
        const r = await privalend.auth.tenantClient.contracts.enable("privalend");
        console.log("enable result:", JSON.stringify(r));
    });
    await probe("token.get-usage (if available)", async () => {
        const client = privalend.auth.client;
        if (client.getUsage) {
            const usage = await client.getUsage({ limit: 5 });
            console.log(JSON.stringify(usage, null, 2));
        }
        else {
            console.log("getUsage not on client");
        }
    });
    await probe("Minimal tee:user/contracts ping — agent-auth-get?", async () => {
        const userContractVersion = await getScriptVersion(nodeUrl, "tee:user/contracts");
        console.log("tee:user/contracts version:", userContractVersion);
        // Try a read-only user contract if exists
        try {
            const r = await privalend.auth.client.executeAndDecode({
                script_name: "tee:user/contracts",
                script_version: userContractVersion,
                function_name: "agent-auth-get",
                input: {},
            });
            console.log("agent-auth-get:", JSON.stringify(r, null, 2));
        }
        catch (e) {
            console.log("agent-auth-get not available or failed:", e.message);
        }
    });
    await probe("KV map name check", async () => {
        const canonical = privalend.auth.tenantClient.canonicalName("eligibility-cache");
        console.log("canonicalName(eligibility-cache):", canonical);
        console.log("tenant DID:", privalend.auth.did);
        const hex = privalend.auth.did.slice("did:t3n:".length);
        console.log("expected map:", `z:${hex}:eligibility-cache`);
        console.log("match:", canonical === `z:${hex}:eligibility-cache`);
    });
    await probe("Tenant contracts.execute — assess-eligibility v0.2.0", async () => {
        const r = await privalend.auth.tenantClient.contracts.execute("privalend", {
            version: "0.2.0",
            functionName: "assess-eligibility",
            input: {
                fraud_result: { is_flagged: false, risk_level: "low" },
                loan_amount: 50000,
                term_months: 36,
            },
        });
        console.log("result:", JSON.stringify(r, null, 2));
    });
    await probe("Agent executeAndDecode — consortium check-blacklist", async () => {
        const wasm = await loadWasmComponent();
        const address = eth_get_address(config.agent.apiKey);
        const agent = new T3nClient({
            wasmComponent: wasm,
            handlers: { EthSign: metamask_sign(address, undefined, config.agent.apiKey) },
        });
        await agent.handshake();
        await agent.authenticate(createEthAuthInput(address));
        const r = await agent.executeAndDecode({
            script_name: consortium.scriptName,
            script_version: consortium.scriptVersion,
            function_name: "check-blacklist",
            input: { user_did: "did:t3n:demo_user_alice" },
        });
        console.log("fraud:", JSON.stringify(r, null, 2));
    });
    await probe("Agent executeAndDecode + pii_did (privalend user)", async () => {
        const wasm = await loadWasmComponent();
        const address = eth_get_address(config.agent.apiKey);
        const agent = new T3nClient({
            wasmComponent: wasm,
            handlers: { EthSign: metamask_sign(address, undefined, config.agent.apiKey) },
        });
        await agent.handshake();
        await agent.authenticate(createEthAuthInput(address));
        const r = await agent.executeAndDecode({
            script_name: privalend.scriptName,
            script_version: privalend.scriptVersion,
            function_name: "assess-eligibility",
            pii_did: privalend.auth.did,
            input: {
                fraud_result: { is_flagged: false, risk_level: "low" },
                loan_amount: 50000,
                term_months: 36,
            },
        });
        console.log("eligibility:", JSON.stringify(r, null, 2));
    });
    await probe("executeBusinessContract (tenant→consortium via agent session)", async () => {
        const wasm = await loadWasmComponent();
        const address = eth_get_address(config.agent.apiKey);
        const agent = new T3nClient({
            wasmComponent: wasm,
            handlers: { EthSign: metamask_sign(address, undefined, config.agent.apiKey) },
        });
        await agent.handshake();
        await agent.authenticate(createEthAuthInput(address));
        const r = await privalend.auth.tenantClient.executeBusinessContract(agent, {
            tenant: consortium.auth.did,
            contract: "fraud-check",
            functionName: "check-blacklist",
            input: { user_did: "did:t3n:demo_user_alice" },
        });
        console.log("cross-tenant:", JSON.stringify(r, null, 2));
    });
    await probe("Consortium direct tenant execute — check-blacklist", async () => {
        const r = await consortium.auth.tenantClient.contracts.execute("fraud-check", {
            version: "0.1.0",
            functionName: "check-blacklist",
            input: { user_did: "did:t3n:demo_user_alice" },
        });
        console.log("result:", JSON.stringify(r, null, 2));
    });
    console.log("\n=== Debug complete ===\n");
}
main().catch((e) => {
    console.error("Fatal:", e);
    process.exit(1);
});
