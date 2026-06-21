import { emitInspectorEvent } from "../websocket.js";
/**
 * Seed a user's financial profile into the T3N KV store.
 * This bypasses the Agent entirely — data goes directly to TEE-accessible storage.
 * Only the TEE contract can read it; the Agent never sees raw financial data.
 */
export async function seedProfileToKV(tenantAuth, profile) {
    const mapName = tenantAuth.tenantClient.canonicalName("eligibility-cache");
    emitInspectorEvent({
        type: "system",
        step: 1,
        title: "🔒 Sealing Profile into T3N Vault",
        content: `Writing encrypted financial data directly to TEE KV store.\nMap: ${mapName}\nKey: user_financial_profile\n\n⚠️ Agent is NOT involved in this step.\nData travels: User → Backend (Tenant) → T3N KV Store → TEE only.`,
        highlight: "blue",
    });
    await tenantAuth.tenantClient.executeControl("map-entry-set", {
        map_name: mapName,
        key: "user_financial_profile",
        value: JSON.stringify(profile),
    });
    emitInspectorEvent({
        type: "system",
        step: 1,
        title: "✅ Profile Sealed — Agent Has Zero Knowledge",
        content: `Financial profile stored in hardware-secured KV store.\nOnly TEE contract "assess-eligibility" can read this data.\nThe AI Agent will only receive: { score, tier, max_loan_amount }`,
        highlight: "green",
    });
}
/**
 * Seed a DID into the fraud blacklist (Consortium tenant).
 * Used for Bob's "flagged user" persona demo.
 */
export async function seedFraudBlacklist(consortiumAuth, userDid, reason) {
    const mapName = consortiumAuth.tenantClient.canonicalName("fraud_blacklist");
    await consortiumAuth.tenantClient.executeControl("map-entry-set", {
        map_name: mapName,
        key: userDid,
        value: JSON.stringify({
            flagged: true,
            reason,
            reported_at: "2026-06-01",
        }),
    });
}
/**
 * Remove a DID from the fraud blacklist (cleanup after demo).
 */
export async function removeFraudBlacklist(consortiumAuth, userDid) {
    const mapName = consortiumAuth.tenantClient.canonicalName("fraud_blacklist");
    try {
        await consortiumAuth.tenantClient.executeControl("map-entry-delete", {
            map_name: mapName,
            key: userDid,
        });
    }
    catch {
        // Ignore if entry doesn't exist
    }
}
