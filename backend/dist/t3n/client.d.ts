import { T3nClient, TenantClient } from "@terminal3/t3n-sdk";
export interface AuthenticatedClient {
    client: T3nClient;
    tenantClient: TenantClient;
    did: string;
    address: string;
}
export declare function createAuthenticatedClient(apiKey: string): Promise<AuthenticatedClient>;
export declare function createAgentClient(apiKey: string): Promise<{
    client: T3nClient;
    did: string;
    address: string;
}>;
