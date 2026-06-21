/**
 * Minimal TEE flow test — isolates executeAndDecode + contracts.logs()
 */
import { createAgentClient } from "../t3n/client.js";
import { config } from "../config.js";
import { setupPrivaLendTenant, setupConsortiumTenant } from "../t3n/tenant-setup.js";
import { seedProfileToKV } from "../t3n/seed-profile.js";
async function main() {
    console.log("\n=== TEE Flow Test ===\n");
    const privalend = await setupPrivaLendTenant();
    const consortium = await setupConsortiumTenant();
    await seedProfileToKV(privalend.auth, {
        annual_income: 150000,
        total_debt: 10000,
        employment_years: 5,
        has_collateral: true,
        credit_history_months: 120,
    });
    console.log("✅ Profile seeded to KV\n");
    const agent = await createAgentClient(config.agent.apiKey);
    console.log(`Agent DID: ${agent.did}`);
    console.log(`PrivaLend script: ${privalend.scriptName} v${privalend.scriptVersion}`);
    console.log(`Consortium script: ${consortium.scriptName} v${consortium.scriptVersion}\n`);
    // 0. Direct tenant execution (bypasses agent — tests contract + KV ACL)
    console.log(`--- [0a] Direct tenant execute v${privalend.scriptVersion} ---`);
    try {
        const direct = await privalend.auth.tenantClient.contracts.execute("privalend", {
            version: privalend.scriptVersion,
            functionName: "assess-eligibility",
            input: {
                fraud_result: { is_flagged: false, risk_level: "low" },
                loan_amount: 50000,
                term_months: 36,
            },
        });
        console.log(`v${privalend.scriptVersion} result:`, JSON.stringify(direct, null, 2));
    }
    catch (e) {
        console.error(`v${privalend.scriptVersion} FAILED:`, e.message || e);
    }
    console.log("\n--- [0b] Direct tenant fraud-check ---");
    try {
        const direct = await consortium.auth.tenantClient.contracts.execute("fraud-check", {
            version: consortium.scriptVersion,
            functionName: "check-blacklist",
            input: { user_did: "did:t3n:demo_user_alice" },
        });
        console.log(`v${consortium.scriptVersion} result:`, JSON.stringify(direct, null, 2));
    }
    catch (e) {
        console.error(`v${consortium.scriptVersion} FAILED:`, e.message || e);
    }
    // 1. Fraud check (cross-tenant — may fail on testnet if agent grant mismatch)
    console.log("--- [1] Cross-tenant fraud check ---");
    let fraudOk = false;
    try {
        const fraud = await agent.client.executeAndDecode({
            script_name: consortium.scriptName,
            script_version: consortium.scriptVersion,
            function_name: "check-blacklist",
            input: { user_did: "did:t3n:demo_user_alice" },
        });
        console.log("Fraud result:", JSON.stringify(fraud, null, 2));
        fraudOk = true;
    }
    catch (e) {
        console.error("Fraud check FAILED (continuing with mock fraud):", e.message || e);
    }
    // 1b. Test logs API even if execute failed
    console.log("\n--- [1b] Consortium TEE logs (logs API) ---");
    try {
        const logs = await consortium.auth.tenantClient.contracts.logs("fraud-check", {
            sinceSeq: 0,
            limit: 20,
            minLevel: "info",
        });
        console.log(`Log entries: ${logs.entries.length}, truncated: ${logs.truncated}, next_seq: ${logs.next_seq}`);
        for (const e of logs.entries) {
            console.log(`  [${e.level}] ${e.message}`);
        }
        if (logs.entries.length === 0) {
            console.log("  ⚠️  Empty — log_max_entries quota likely disabled on testnet");
        }
    }
    catch (e) {
        console.error("Logs fetch FAILED:", e.message || e);
    }
    if (!fraudOk) {
        console.log("\n(Cross-tenant failed — testing same-tenant assess-eligibility anyway)\n");
    }
    // 2. Eligibility (same-tenant via agent)
    console.log("\n--- [2] assess-eligibility ---");
    try {
        const eligibility = await agent.client.executeAndDecode({
            script_name: privalend.scriptName,
            script_version: privalend.scriptVersion,
            function_name: "assess-eligibility",
            input: {
                fraud_result: { is_flagged: false, risk_level: "low" },
                loan_amount: 50000,
                term_months: 36,
            },
        });
        console.log("Eligibility:", JSON.stringify(eligibility, null, 2));
    }
    catch (e) {
        console.error("Eligibility FAILED:", e.message || e);
        const id = e.message?.match(/\[([0-9a-f-]{36})\]/i)?.[1];
        console.error("\n=== DIAGNOSIS ===");
        console.error("All TEE contract executes return HTTP 500 internal_error.");
        console.error("Control plane works (auth, KV seed, agent-auth). TEE runtime is down.");
        if (id)
            console.error(`Latest request_id: ${id}`);
        console.error("Report to: devrel@terminal3.io");
        console.error("Run: npm run debug:tee");
        process.exit(1);
    }
    // 3. PrivaLend logs
    console.log("\n--- [3] PrivaLend TEE logs ---");
    try {
        const logs = await privalend.auth.tenantClient.contracts.logs("privalend", {
            sinceSeq: 0,
            limit: 20,
            minLevel: "info",
        });
        console.log(`Log entries: ${logs.entries.length}`);
        for (const e of logs.entries) {
            console.log(`  [${e.level}] ${e.message}`);
        }
    }
    catch (e) {
        console.error("Logs fetch FAILED:", e.message || e);
    }
    console.log("\n=== Test Complete ===\n");
}
main().catch((e) => {
    console.error("Fatal:", e);
    process.exit(1);
});
