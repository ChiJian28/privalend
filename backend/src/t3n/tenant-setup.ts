import { readFile } from "fs/promises";
import { resolve } from "path";
import { getScriptVersion, getNodeUrl } from "@terminal3/t3n-sdk";
import { createAuthenticatedClient, type AuthenticatedClient } from "./client.js";
import { config } from "../config.js";
import { emitInspectorEvent } from "../websocket.js";

export interface TenantDeployment {
  auth: AuthenticatedClient;
  contractId: number;
  scriptName: string;
  scriptVersion: string;
}

/** Known contract IDs per version (updated when re-deploying WASM). */
const KNOWN_CONTRACT_IDS: Record<string, Record<string, number>> = {
  privalend: { "0.2.0": 189, "0.1.0": 182 },
  "fraud-check": { "0.1.0": 183 },
};

async function ensureContractMapAccess(
  auth: AuthenticatedClient,
  contractId: number,
  mapTails: string[]
): Promise<void> {
  for (const tail of mapTails) {
    try {
      await auth.tenantClient.maps.update(tail, {
        writers: { only: [contractId] },
        readers: { only: [contractId] },
      });
      console.log(`[Setup] Updated ${tail} map ACL for contract #${contractId}`);
    } catch (e: any) {
      console.log(`[Setup] Could not update ${tail} ACL: ${e.message}`);
    }
  }
}

/**
 * Set up PrivaLend tenant:
 * - Authenticate as tenant
 * - Register the privalend TEE contract
 * - Create KV maps (secrets, eligibility-cache)
 * - Seed mock lender API key into secrets
 */
export async function setupPrivaLendTenant(): Promise<TenantDeployment> {
  console.log("[Setup] Authenticating PrivaLend tenant...");
  const auth = await createAuthenticatedClient(config.privalend.apiKey);
  console.log(`[Setup] PrivaLend tenant DID: ${auth.did}`);

  const CONTRACT_TAIL = "privalend";
  const CONTRACT_VERSION = "0.2.0";
  const WASM_PATH = resolve(import.meta.dirname, "../../contracts/privalend/target/wasm32-wasip2/release/z_privalend.wasm");

  const tenantId = auth.did.slice("did:t3n:".length);
  const scriptName = `z:${tenantId}:${CONTRACT_TAIL}`;

  // Try to register; if version already exists, just connect to it
  let contractId: number;
  try {
    const wasmBytes = await readFile(WASM_PATH);
    console.log(`[Setup] Registering PrivaLend contract (${wasmBytes.length} bytes)...`);
    const result = await auth.tenantClient.contracts.register({
      tail: CONTRACT_TAIL,
      version: CONTRACT_VERSION,
      wasm: wasmBytes,
    });
    contractId = result.contract_id;
    console.log(`[Setup] Registered ${scriptName} as contract id ${contractId}`);
  } catch (e: any) {
    if (e.message?.includes("is not higher than current version")) {
      console.log(`[Setup] Contract already deployed at ${scriptName} — connecting to existing`);
      contractId = KNOWN_CONTRACT_IDS[CONTRACT_TAIL]?.[CONTRACT_VERSION] ?? 189;
      console.log(`[Setup] Using known contract id #${contractId} for ${CONTRACT_VERSION}`);
    } else {
      throw e;
    }
  }

  // Create secrets map (stores lender API keys)
  try {
    await auth.tenantClient.maps.create({
      tail: "secrets",
      visibility: "private",
      writers: { only: [contractId] },
      readers: { only: [contractId] },
    });
    console.log("[Setup] Created secrets map");
  } catch (e: any) {
    if (e.message?.includes("already exists")) {
      console.log("[Setup] Secrets map already exists (idempotent)");
    } else throw e;
  }

  // Create eligibility-cache map
  try {
    await auth.tenantClient.maps.create({
      tail: "eligibility-cache",
      visibility: "private",
      writers: { only: [contractId] },
      readers: { only: [contractId] },
    });
    console.log("[Setup] Created eligibility-cache map");
  } catch (e: any) {
    if (e.message?.includes("already exists")) {
      console.log("[Setup] Eligibility-cache map already exists (idempotent)");
    } else throw e;
  }

  // Ensure the active contract can read/write KV maps (needed after version bumps)
  await ensureContractMapAccess(auth, contractId, ["secrets", "eligibility-cache"]);

  // Seed mock lender API key
  await auth.tenantClient.executeControl("map-entry-set", {
    map_name: auth.tenantClient.canonicalName("secrets"),
    key: "lender_api_key",
    value: "mock_lender_key_12345",
  });
  console.log("[Setup] Seeded lender API key into secrets map");

  const scriptVersion = await getScriptVersion(getNodeUrl(), scriptName);

  return { auth, contractId, scriptName, scriptVersion };
}

/**
 * Set up Fraud Consortium tenant:
 * - Authenticate as tenant
 * - Register the fraud-check TEE contract
 * - Create and populate the fraud_blacklist map
 */
export async function setupConsortiumTenant(): Promise<TenantDeployment> {
  console.log("[Setup] Authenticating Fraud Consortium tenant...");
  const auth = await createAuthenticatedClient(config.consortium.apiKey);
  console.log(`[Setup] Consortium tenant DID: ${auth.did}`);

  const CONTRACT_TAIL = "fraud-check";
  const CONTRACT_VERSION = "0.1.0";
  const WASM_PATH = resolve(import.meta.dirname, "../../contracts/fraud-consortium/target/wasm32-wasip2/release/z_fraud_consortium.wasm");

  const tenantId = auth.did.slice("did:t3n:".length);
  const scriptName = `z:${tenantId}:${CONTRACT_TAIL}`;

  let contractId: number;
  try {
    const wasmBytes = await readFile(WASM_PATH);
    console.log(`[Setup] Registering Fraud Consortium contract (${wasmBytes.length} bytes)...`);
    const result = await auth.tenantClient.contracts.register({
      tail: CONTRACT_TAIL,
      version: CONTRACT_VERSION,
      wasm: wasmBytes,
    });
    contractId = result.contract_id;
    console.log(`[Setup] Registered ${scriptName} as contract id ${contractId}`);
  } catch (e: any) {
    if (e.message?.includes("is not higher than current version")) {
      console.log(`[Setup] Contract already deployed at ${scriptName} — connecting to existing`);
      contractId = KNOWN_CONTRACT_IDS[CONTRACT_TAIL]?.[CONTRACT_VERSION] ?? 183;
      console.log(`[Setup] Using known contract id #${contractId} for ${CONTRACT_VERSION}`);
    } else {
      throw e;
    }
  }

  // Create fraud_blacklist map
  try {
    await auth.tenantClient.maps.create({
      tail: "fraud_blacklist",
      visibility: "private",
      writers: { only: [contractId] },
      readers: { only: [contractId] },
    });
    console.log("[Setup] Created fraud_blacklist map");
  } catch (e: any) {
    if (e.message?.includes("already exists")) {
      console.log("[Setup] fraud_blacklist map already exists (idempotent)");
    } else throw e;
  }

  await ensureContractMapAccess(auth, contractId, ["fraud_blacklist"]);

  // Seed sample blacklist entries (for demo)
  const blacklistedDids = [
    "did:t3n:0000000000000000000000000000000000000bad",
    "did:t3n:deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
  ];

  for (const did of blacklistedDids) {
    await auth.tenantClient.executeControl("map-entry-set", {
      map_name: auth.tenantClient.canonicalName("fraud_blacklist"),
      key: did,
      value: JSON.stringify({ flagged: true, reason: "multi-lending fraud", reported_at: "2026-05-15" }),
    });
  }
  console.log("[Setup] Seeded fraud blacklist with sample entries");

  const scriptVersion = await getScriptVersion(getNodeUrl(), scriptName);

  return { auth, contractId, scriptName, scriptVersion };
}
