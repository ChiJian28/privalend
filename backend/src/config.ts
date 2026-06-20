import dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(import.meta.dirname, "../.env") });

function optionalContractId(envKey: string): number | undefined {
  const raw = process.env[envKey];
  if (!raw) return undefined;
  const id = parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : undefined;
}

export const config = {
  privalend: {
    apiKey: process.env.PRIVALEND_API_KEY!,
    did: process.env.PRIVALEND_DID!,
    contractId: optionalContractId("PRIVALEND_CONTRACT_ID"),
  },
  consortium: {
    apiKey: process.env.CONSORTIUM_API_KEY!,
    did: process.env.CONSORTIUM_DID!,
    contractId: optionalContractId("CONSORTIUM_CONTRACT_ID"),
  },
  agent: {
    apiKey: process.env.AGENT_API_KEY!,
    did: process.env.AGENT_DID!,
  },
  t3n: {
    environment: (process.env.T3N_ENVIRONMENT || "testnet") as "testnet" | "production",
  },
  mockBank: {
    port: parseInt(process.env.MOCK_BANK_PORT || "4000"),
    baseUrl: `http://localhost:${process.env.MOCK_BANK_PORT || "4000"}`,
  },
  server: {
    port: parseInt(process.env.PORT || "3001"),
  },
};
