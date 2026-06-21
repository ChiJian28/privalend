import { type AuthenticatedClient } from "./client.js";
export interface TenantDeployment {
    auth: AuthenticatedClient;
    contractId: number;
    scriptName: string;
    scriptVersion: string;
}
/**
 * Set up PrivaLend tenant:
 * - Authenticate as tenant
 * - Register the privalend TEE contract
 * - Create KV maps (secrets, eligibility-cache)
 * - Seed mock lender API key into secrets
 */
export declare function setupPrivaLendTenant(): Promise<TenantDeployment>;
/**
 * Set up Fraud Consortium tenant:
 * - Authenticate as tenant
 * - Register the fraud-check TEE contract
 * - Create and populate the fraud_blacklist map
 */
export declare function setupConsortiumTenant(): Promise<TenantDeployment>;
