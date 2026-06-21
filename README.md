# 🛡️ PrivaLend: Zero-Data AI Credit Network

**Privacy-preserving AI loan marketplace agent on Terminal 3 (T3N)**

> Hackathon track: **Best Agent utilising Terminal 3 Agent Auth SDK**  
> Built for the Terminal 3 Bounty Challenge (June 2026)


## Overview

PrivaLend is a next-generation AI orchestrator that negotiates and applies for loans on behalf of the user without ever seeing the user's actual financial data or PII. By utilizing the Terminal 3 Network (T3N), PrivaLend shifts sensitive computations into hardware-attested Trusted Execution Environments (TEEs), ensuring absolute data privacy, cross-tenant fraud screening, and tamper-proof regulatory compliance.


## Problem Statement

Traditional loan agents need access to sensitive financial and identity data. That creates three problems:

1. **PII exposure** — Agents, logs, and third-party APIs can leak raw user data.
2. **Cross-org trust** — Fraud checks often require sharing data with external consortiums without revealing *why* a user is flagged.
3. **Unverifiable outcomes** — Credit decisions lack cryptographically attestable credentials tied to TEE execution.

Enterprises need agents that can **act on behalf of users** while staying inside privacy and data-governance boundaries.


## Solution

PrivaLend resolves this paradox through a **Confidential Compute Topology** built on Terminal 3.

### 1. Blind AI Orchestration

The AI Agent functions purely as an intent orchestrator and workflow coordinator. It never accesses or stores raw financial information within its context window, minimizing the risk of sensitive data exposure.

### 2. TEE-Level Computation

Sensitive borrower data is sealed directly into the T3N KV Vault. Rust-based TEE contracts securely retrieve the encrypted data, perform credit scoring inside a hardware-secured enclave, and return only a sanitized result (e.g., *Credit Tier A*, *Score: 780*) to the Agent.

### 3. Cross-Tenant Security

Prior to loan evaluation, the Agent performs a cross-tenant invocation to an independent **Fraud Consortium** (Tenant B). Using Confidential Multi-Party Computation (MPC), fraud and blacklist checks can be performed without exposing proprietary datasets between organizations.

### 4. Zero-Knowledge Egress

When submitting an application to lenders, the Agent sends payload templates containing placeholders (e.g., `{{profile.name}}`) rather than actual user data. The T3N node securely resolves these placeholders immediately before HTTP egress, ensuring that plaintext data never appears in the Agent runtime.


## Key Features

### 🛡️ Hardware-Isolated Credit Scoring

The user's financial inputs (income, debt) bypass the AI agent entirely and are sealed directly into the T3N KV Vault via the Tenant Control Plane. The TEE contract securely reads this data internally to compute a credit score. The Agent is blind to the raw data.

### 🔗 Cross-Tenant Fraud Consortium (Confidential MPC)

Before generating loan offers, the PrivaLend Agent orchestrates a cross-tenant call to an independent "Fraud Consortium" (Tenant B). The consortium evaluates the user's DID against a private blacklist inside its own enclave, returning only a boolean risk signal. Zero cross-tenant PII spillage.

### 😈 "Rogue Agent" Attack Simulation (Live Demo)

Triggering this mode shows a rogue agent attempting an unauthorized memory read of the KV Vault. The T3N hypervisor instantly intercepts the syscall, terminating the execution and preventing data leakage.

### 🎭 Zero-Knowledge Outbound Egress

When submitting the final loan application to the Mock Bank, the Agent transmits a payload consisting strictly of T3N Placeholders (e.g., `{{profile.first_name}}`). The T3N node dynamically injects the real PII immediately prior to HTTP egress, keeping the Agent's context window clean.

### 📜 Cryptographic Audit & Verifiable Credentials

Upon loan approval, PrivaLend issues a W3C-compliant Verifiable Credential (mocked for TEE issuance readiness). Additionally, users can generate a Merkle-backed Certificate of Confidential Compute, proving to regulators exactly what data the agent did not see.

### 🎛️ Dual-Reality Inspector & Living Topology

A custom-built UI that splits the user's perspective into two realities: The restricted Agent's context (left) and the privileged TEE Enclave's execution logs (right), all laid over a real-time, fluid SVG architecture diagram.


## T3 SDK Integration

| Capability | Implementation | Status |
|------------|----------------|--------|
| **Agent Auth & Delegation** | Executed `agent-auth-update` to bound the agent with strict `allowedHosts` and functional scopes. | ✅ |
| **TEE Contracts (WASM)** | Built and deployed 2 separate Rust contracts (`privalend`, `fraud-check`) to the T3N testnet. | ✅ |
| **Tenant KV Store** | Used `map-entry-set` to seal PII directly into the vault (bypassing the Agent), and `kv-store` Host API to read it inside the TEE. | ✅ |
| **Cross-Tenant Calls** | Orchestrated `executeAndDecode` from the authorized agent to the Fraud Consortium contract for secure risk signaling. | ✅ |
| **Outbound HTTP** | Designed `http::call` to fetch dynamic loan pricing from Bank APIs based on TEE-computed credit scores. | ✅ |
| **Placeholders Egress** | Designed `http-with-placeholders` to inject PII into the bank application payload without Agent exposure. | ✅ |


## Tech Stack

- **Frontend** — Next.js 16, React, Tailwind CSS
- **Backend** — Node.js, Express, TypeScript
- **Terminal 3 SDK** — `@terminal3/t3n-sdk`
- **TEE contracts** — Rust → WASM (`privalend`, `fraud-consortium`)

**UI scope:** Desktop/laptop viewport only. Not optimized for phones or tablets.


## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **Rust** + `wasm32-wasip2` target (for contract builds)
- **T3N testnet accounts** — PrivaLend tenant, Fraud Consortium tenant, Agent identity ([claim sandbox tokens](https://terminal3.io))
- Sufficient **tenant credits** on testnet for TEE execution

### 1. Clone and install

```bash
git clone
cd terminal_3

cd backend && npm install
cd ../frontend && npm install
```

### 2. Backend environment

Create `backend/.env` (never commit this file):

```env
PRIVALEND_DID=did:t3n:<your-privalend-tenant-hex>
PRIVALEND_API_KEY=<privalend-api-key>
PRIVALEND_CONTRACT_ID=<contract-id>

CONSORTIUM_DID=did:t3n:<consortium-tenant-hex>
CONSORTIUM_API_KEY=<consortium-api-key>
CONSORTIUM_CONTRACT_ID=<contract-id>

AGENT_DID=did:t3n:<agent-hex>
AGENT_API_KEY=<agent-api-key>
```

### 3. Build contracts & deploy (first time)

```bash
cd backend
npm run setup:contracts    # Build Rust → WASM
npm run setup:tenants      # Register on T3N testnet, create maps
npx tsx src/scripts/authorize-agent.ts   # User delegates agent permissions
```

### 4. Run services

```bash
# Terminal 1 — Backend (API :3001, Bank :4000, WebSocket)
cd backend && npx tsx src/index.ts

# Terminal 2 — Frontend (:3000)
cd frontend && npm run dev
```

Open **http://localhost:3000**. The sidebar badge shows **LIVE** when connected to the backend WebSocket.


## Demo

https://github.com/user-attachments/assets/fee9e3f9-27fb-4714-940d-4a5e13e55ce7

**End-to-end flow:**

1. User selects a persona or enters custom financial inputs → profile sealed into T3N KV (bypasses agent).
2. Agent calls **fraud-check** (Consortium TEE) → pass/fail signal only.
3. Agent calls **assess-eligibility** (PrivaLend TEE) → score + tier from enclave.
4. Agent calls **fetch-offers** → tier-based offers (no PII in request).
5. User picks an offer → **submit-application** + **issue-credit-credential** via session-scoped apply.

Additional demo features: Bob blacklist rejection, malicious-attack graph visualization, Audit Trail export, Verifiable Credit Credential card.


## Project Structure

```
terminal_3/
├── README.md
├── frontend/
│   ├── src/
│   │   ├── app/               # Next.js app router (page → Workspace)
│   │   ├── hooks/
│   │   │   └── useWorkflow.ts # Live/Demo orchestration, sessionId, UI pacing
│   │   ├── components/
│   │   │   └── workspace/     # CommandCenter, LivingGraph, InspectorConsole
│   │   └── lib/
│   │       ├── graph-choreography.ts
│   │       └── credential.ts
│   └── package.json
│
└── backend/
    ├── src/
    │   ├── index.ts           # Express + WebSocket bootstrap
    │   ├── routes/api.ts      # /api/demo/start, /api/demo/apply, /api/tee-health
    │   ├── t3n/
    │   │   ├── client.ts      # T3nClient / TenantClient factory
    │   │   ├── agent-workflow.ts   # Core TEE orchestration
    │   │   ├── workflow-session.ts # One-time apply sessions
    │   │   ├── tenant-setup.ts
    │   │   ├── seed-profile.ts
    │   │   └── issue-credential.ts
    │   ├── mock-bank/         # Lender API stub (:4000)
    │   └── scripts/           # setup, authorize-agent, test:tee
    ├── contracts/
    │   ├── privalend/         # assess-eligibility, fetch-offers, submit-application, issue_vc
    │   └── fraud-consortium/  # check-blacklist
    └── package.json
```


## Future Work

As this repository was built specifically for the T3N Hackathon, certain design choices were made to prioritize the demonstration of cryptographic infrastructure over standard web features:

- **Desktop-First Visualization (No Mobile Support)** — To best visualize the complex T3N Confidential Compute Topology Graph and the split-screen Dual-Reality Inspector, this application is designed exclusively for desktop viewing. Mobile responsiveness was intentionally omitted to focus 100% of our development effort on showcasing the deep capabilities of the T3N SDK.

- **In-Enclave PDF/OCR Parsing** — Currently, user financial data is sealed into the T3N Vault via UI preset personas or manual form input. In a future production environment, users will upload raw PDF bank statements. These PDFs will be passed directly into the TEE, where an integrated OCR/parsing module will extract the financial data inside the secure enclave, further removing any reliance on client-side data structuring.

- **Live Verifiable Credentials (VC)** — Once the `sign-sd-jwt-vc` endpoint moves from "Coming Soon" to "Live" on the T3N Testnet, the mock JSON-LD credentials generated at the end of the workflow will be replaced with actual cryptographic signatures anchored to the issuer's DID.

