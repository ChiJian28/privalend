import { T3nClient, TenantClient, setEnvironment, loadWasmComponent, eth_get_address, metamask_sign, createEthAuthInput, getNodeUrl, } from "@terminal3/t3n-sdk";
import { config } from "../config.js";
let wasmComponent = null;
async function getWasmComponent() {
    if (!wasmComponent) {
        wasmComponent = await loadWasmComponent();
    }
    return wasmComponent;
}
export async function createAuthenticatedClient(apiKey) {
    setEnvironment(config.t3n.environment);
    const wasm = await getWasmComponent();
    const address = eth_get_address(apiKey);
    const client = new T3nClient({
        wasmComponent: wasm,
        handlers: {
            EthSign: metamask_sign(address, undefined, apiKey),
        },
    });
    await client.handshake();
    const did = await client.authenticate(createEthAuthInput(address));
    const tenantDid = did.value;
    const tenantClient = new TenantClient({
        t3n: client,
        baseUrl: getNodeUrl(),
        tenantDid,
    });
    return { client, tenantClient, did: tenantDid, address };
}
export async function createAgentClient(apiKey) {
    setEnvironment(config.t3n.environment);
    const wasm = await getWasmComponent();
    const address = eth_get_address(apiKey);
    const client = new T3nClient({
        wasmComponent: wasm,
        handlers: {
            EthSign: metamask_sign(address, undefined, apiKey),
        },
    });
    await client.handshake();
    const did = await client.authenticate(createEthAuthInput(address));
    return { client, did: did.value, address };
}
