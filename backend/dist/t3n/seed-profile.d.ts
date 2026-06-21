import type { AuthenticatedClient } from "./client.js";
export interface FinancialProfile {
    annual_income: number;
    total_debt: number;
    employment_years: number;
    has_collateral: boolean;
    credit_history_months: number;
}
/**
 * Seed a user's financial profile into the T3N KV store.
 * This bypasses the Agent entirely — data goes directly to TEE-accessible storage.
 * Only the TEE contract can read it; the Agent never sees raw financial data.
 */
export declare function seedProfileToKV(tenantAuth: AuthenticatedClient, profile: FinancialProfile): Promise<void>;
/**
 * Seed a DID into the fraud blacklist (Consortium tenant).
 * Used for Bob's "flagged user" persona demo.
 */
export declare function seedFraudBlacklist(consortiumAuth: AuthenticatedClient, userDid: string, reason: string): Promise<void>;
/**
 * Remove a DID from the fraud blacklist (cleanup after demo).
 */
export declare function removeFraudBlacklist(consortiumAuth: AuthenticatedClient, userDid: string): Promise<void>;
