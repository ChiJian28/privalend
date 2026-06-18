# PrivaLend Backend

Privacy-Preserving AI Loan Marketplace Agent built on Terminal 3 Network (T3N).

## Architecture

```
backend/
├── src/
│   ├── index.ts              ← Express + WebSocket server
│   ├── config.ts             ← Environment configuration
│   ├── websocket.ts          ← Real-time Inspector event system
│   ├── t3n/
│   │   ├── client.ts         ← T3N SDK client factory
│   │   ├── tenant-setup.ts   ← Tenant registration & map provisioning
│   │   └── agent-workflow.ts ← Agent orchestration (the main workflow)
│   ├── routes/
│   │   └── api.ts            ← REST API for frontend
│   ├── mock-bank/
│   │   └── server.ts         ← Mock lender API (records received payloads)
│   └── scripts/
│       ├── deploy-contracts.ts  ← Build Rust contracts to WASM
│       ├── setup-tenants.ts     ← Deploy to T3N testnet
│       ├── authorize-agent.ts   ← User authorizes agent (agent-auth-update)
│       └── run-demo.ts          ← Standalone demo (terminal output)
├── contracts/
│   ├── privalend/            ← PrivaLend TEE contract (Rust → WASM)
│   │   ├── src/
│   │   │   ├── lib.rs
│   │   │   ├── eligibility.rs   ← Credit scoring inside TEE
│   │   │   ├── offers.rs        ← Fetch offers via http (no PII)
│   │   │   └── application.rs   ← Submit via http-with-placeholders
│   │   └── wit/world.wit
│   └── fraud-consortium/     ← Fraud Consortium TEE contract (Rust → WASM)
│       ├── src/
│       │   ├── lib.rs
│       │   └── blacklist.rs     ← Blacklist lookup inside TEE
│       └── wit/world.wit
```

## Prerequisites

1. **Node.js** >= 18
2. **Rust** with `wasm32-wasip2` target:
   ```bash
   rustup target add wasm32-wasip2
   cargo install wasm-tools
   ```
3. **T3N Accounts**: You need 3 separate DIDs from T3N:
   - PrivaLend tenant (platform operator)
   - Fraud Consortium tenant (industry alliance)
   - Agent identity (the AI agent)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Build Rust contracts to WASM
npm run setup:contracts

# 3. Deploy to T3N testnet (registers contracts, creates maps, seeds secrets)
npm run setup:tenants

# 4. Start the server
npm run dev
```

## Demo

```bash
# Standalone terminal demo (no frontend needed)
npm run demo

# Or start the server and use the API
npm run dev
# Then POST to http://localhost:3001/api/demo/start
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Server health check |
| GET | /api/status | Tenant deployment status |
| POST | /api/workflow/start | Start loan workflow |
| POST | /api/workflow/apply | Submit application for selected offer |
| POST | /api/demo/start | Demo mode: full workflow |
| POST | /api/demo/apply | Demo mode: submit application |

## WebSocket Events

Connect to `ws://localhost:3001` to receive real-time Inspector events:

```typescript
{
  type: "agent_action" | "agent_received" | "tee_simulated" | "placeholder_before" | "placeholder_after" | "cross_tenant" | "audit_log",
  step: number,
  title: string,
  content: string,
  highlight: "red" | "green" | "yellow" | "blue" | "gray",
  timestamp: number
}
```

## SDK Features Used

- ✅ T3nClient + Ethereum wallet authentication
- ✅ TenantClient (tenant operations)
- ✅ tenant.contracts.register (WASM deployment)
- ✅ tenant.maps.create + ACLs (readers/writers)
- ✅ executeControl("map-entry-set") (seed secrets)
- ✅ kv-store host interface (read secrets & cache)
- ✅ http host interface (query lender APIs, no PII)
- ✅ http-with-placeholders (submit application with PII)
- ✅ logging host interface (audit trail)
- ✅ tenant-context (namespace management)
- ✅ Agent Auth + agent-auth-update (user delegation)
- ✅ executeBusinessContract (Cross-Tenant: PrivaLend → Fraud Consortium)
