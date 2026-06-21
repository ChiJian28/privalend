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

/** Fallback contract IDs keyed by `<tenantHex>:<tail>:<version>`. Update after deploy. */
const KNOWN_CONTRACT_IDS: Record<string, number> = {
  "8b5e0d443d68570f4800da31e46d1581d603b8db:privalend:0.2.1": 274,
  "8b5e0d443d68570f4800da31e46d1581d603b8db:privalend:0.2.2": 276,
  "c2278f96d01845b152308cb5940a7f6125952ad0:privalend:0.2.2": 401,
  "377025df4be81d8222dd63ecf63a8b351bb109f2:fraud-check:0.1.1": 275,
};

function shouldSkipWasmRegistration(): boolean {
  return (
    process.env.SKIP_WASM_DEPLOY === "true" ||
    process.env.NODE_ENV === "production"
  );
}

async function resolveOrRegisterContract(
  auth: AuthenticatedClient,
  options: {
    tail: string;
    version: string;
    wasmPath: string;
    envContractId?: number;
  }
): Promise<{ contractId: number; scriptName: string }> {
  const { tail, version, wasmPath, envContractId } = options;
  const tenantId = auth.did.slice("did:t3n:".length);
  const scriptName = `z:${tenantId}:${tail}`;

  if (shouldSkipWasmRegistration()) {
    const contractId = resolveExistingContractId(auth, tail, version, envContractId);
    console.log(
      `[Setup] Connect-only mode (no WASM) — using contract id #${contractId} for ${scriptName}`
    );
    return { contractId, scriptName };
  }

  try {
    const wasmBytes = await readFile(wasmPath);
    console.log(`[Setup] Registering contract (${wasmBytes.length} bytes)...`);
    const result = (await auth.tenantClient.contracts.register({
      tail,
      version,
      wasm: wasmBytes,
    })) as { contract_id: number };
    const contractId = result.contract_id;
    console.log(`[Setup] Registered ${scriptName} as contract id ${contractId}`);
    return { contractId, scriptName };
  } catch (e: any) {
    if (e.code === "ENOENT") {
      const contractId = resolveExistingContractId(auth, tail, version, envContractId);
      console.log(
        `[Setup] WASM not found at ${wasmPath} — connecting to contract id #${contractId}`
      );
      return { contractId, scriptName };
    }
    if (e.message?.includes("is not higher than current version")) {
      console.log(`[Setup] Contract already deployed at ${scriptName} — connecting to existing`);
      const contractId = resolveExistingContractId(auth, tail, version, envContractId);
      console.log(`[Setup] Using contract id #${contractId} for ${version}`);
      return { contractId, scriptName };
    }
    throw e;
  }
}

function contractLookupKey(tenantId: string, tail: string, version: string): string {
  return `${tenantId}:${tail}:${version}`;
}

function resolveExistingContractId(
  auth: AuthenticatedClient,
  tail: string,
  version: string,
  envOverride?: number
): number {
  if (envOverride) return envOverride;

  const tenantId = auth.did.slice("did:t3n:".length);
  const key = contractLookupKey(tenantId, tail, version);
  const known = KNOWN_CONTRACT_IDS[key];
  if (known) return known;

  throw new Error(
    `[Setup] No contract id for ${key}. Run setup:tenants once, then set ` +
      `${tail === "privalend" ? "PRIVALEND" : "CONSORTIUM"}_CONTRACT_ID in .env ` +
      `or update KNOWN_CONTRACT_IDS in tenant-setup.ts`
  );
}

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
  const CONTRACT_VERSION = "0.2.2";
  const WASM_PATH = resolve(import.meta.dirname, "../../contracts/privalend/target/wasm32-wasip2/release/z_privalend.wasm");

  const { contractId, scriptName } = await resolveOrRegisterContract(auth, {
    tail: CONTRACT_TAIL,
    version: CONTRACT_VERSION,
    wasmPath: WASM_PATH,
    envContractId: config.privalend.contractId,
  });

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
  const CONTRACT_VERSION = "0.1.1";
  const WASM_PATH = resolve(import.meta.dirname, "../../contracts/fraud-consortium/target/wasm32-wasip2/release/z_fraud_consortium.wasm");

  const { contractId, scriptName } = await resolveOrRegisterContract(auth, {
    tail: CONTRACT_TAIL,
    version: CONTRACT_VERSION,
    wasmPath: WASM_PATH,
    envContractId: config.consortium.contractId,
  });

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
