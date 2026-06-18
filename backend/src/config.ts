import dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(import.meta.dirname, "../.env") });

export const config = {
  privalend: {
    apiKey: process.env.PRIVALEND_API_KEY!,
    did: process.env.PRIVALEND_DID!,
  },
  consortium: {
    apiKey: process.env.CONSORTIUM_API_KEY!,
    did: process.env.CONSORTIUM_DID!,
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
