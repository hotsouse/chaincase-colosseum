<div align="center">

<img src="assets/chaincase-logo.png" alt="ChainCase project logo" width="180" />

# ChainCase

### Solana Payment Dispute Investigation

**Verify on-chain facts. Investigate conflicting payment records. Export evidence.**

![Solana](https://img.shields.io/badge/Solana-Devnet%20%2B%20Mainnet-6B46C1) ![Node.js](https://img.shields.io/badge/Node.js-20.11%2B-43853D) ![License](https://img.shields.io/badge/License-MIT-blue) ![Colosseum](https://img.shields.io/badge/Colosseum-2026-black) ![Status](https://img.shields.io/badge/Status-Hackathon%20MVP-orange)

[Features](#features) · [Architecture](#architecture) · [Quick Start](#start-in-3-steps) · [Testing](#testing) · [Limitations](#limitations-and-threat-model)

</div>

---

> **Hackathon submission:** Colosseum Crypto World's Fair 2026 — Payments & Remittance. ChainCase is an early-stage, read-only MVP, **not** a payment gateway, custody solution, settlement certificate, or production-ready financial system.

## The problem

A stablecoin transfer can be finalized on Solana while a merchant's order management system or a payment provider reports **FAILED**, **PENDING**, or **UNKNOWN**. Teams then manually inspect blockchain explorers and reconcile separate records. Blockchain confirmation alone does **not** establish that the merchant received a credit from a payment processor.

## Our solution

ChainCase investigates a single disputed SPL-token payment by comparing **independently retrieved Solana transaction evidence** with the **merchant and provider statuses supplied by the user**. It highlights contradictions, preserves uncertainty, and generates a structured investigation report. It never signs transactions or moves funds.

## Who it is for

Crypto-native SaaS businesses, digital agencies, and online merchants that accept Solana stablecoin payments and need a repeatable way to examine disputed orders.

## Features

| Capability | MVP behavior |
| --- | --- |
| On-chain verification | Queries Solana JSON-RPC for transaction details and finality |
| SPL-token checks | Compares recipient token account, token mint, and exact raw token amount |
| Discrepancy detection | Flags mismatches, failed transactions, and conflicting reported statuses |
| Evidence provenance | Distinguishes independently verified chain facts from imported claims |
| CSV import | Imports order status rows with `order_id,merchant_status,provider_status` |
| Investigation exports | Exports JSON evidence packages and printable reports |
| Local case history | Stores cases in browser local storage, with no account required |
| Safe demo mode | Offers clearly labeled simulated scenarios for walkthroughs |

## Why Solana

Solana's public ledger lets ChainCase independently inspect transaction execution, finality, and SPL-token transfer details. This is useful when off-chain payment records disagree. The blockchain provides evidence about the transfer; it does **not** authenticate merchant ledgers or provider claims.

## Week 9 — DeFi on Solana

ChainCase adds an optional, read-only [Jupiter Swap API V2](https://developers.jup.ag/docs/swap) quote for the exact amount of a successfully verified **mainnet** SPL-token transfer, expressed as indicative USDC output. This gives an investigator current market context for a received asset without changing the investigation's evidence or moving funds. The quote is not a historical valuation, settlement proof, or guaranteed execution price. No wallet, signer, swap transaction, or Anchor program is used. Demo and Devnet cases do not call Jupiter. See [WEEK9_DEFI.md](WEEK9_DEFI.md) for the architecture, security model, tests and presentation notes.

## Product preview

Run the local app using the instructions below to explore ChainCase and sample investigations. **A public deployment and video links have not yet been added.** Add authentic screenshots or a recorded demo once captured.

## Architecture

```text
Merchant / operator
      |
      v
Browser UI (HTML / CSS / JavaScript)
  |-- Case inputs and CSV status import
  |-- Deterministic discrepancy engine
  |-- Local case history and evidence export
  |
  +--> POST /api/verify
           |
           v
       Node.js HTTP backend
           |
           +--> Solana JSON-RPC
                  |-- getTransaction (finalized)
                  +-- getSignatureStatuses (fallback)
           |
```

**Trust boundary:** blockchain responses provide on-chain evidence; manually entered or CSV-imported merchant/provider statuses remain unverified claims. No smart contract is needed because the app does not execute payments.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | HTML, CSS, vanilla JavaScript |
| Backend | Node.js native HTTP server |
| Blockchain | Solana JSON-RPC; parsed SPL-token instructions |
| DeFi context | Jupiter Swap API V2 quote-only route to USDC; mainnet only |
| Data | Browser `localStorage`, CSV import, JSON export |
| Verification | Deterministic checks with `BigInt` for raw token amounts |
| Tests | Node.js test runner, mocked RPC, smoke tests |
| Deployment assets | Dockerfile and CI workflow |

## Testing

```bash
npm test
npm run smoke
```

The automated suite passes **59 tests** with mocked RPC/Jupiter responses. These tests do not prove live network connectivity. `npm run smoke` checks local routes and invalid transaction handling only.

## Team and development

Independent student-led project. AI coding assistance, including ChatGPT, was used for architecture, implementation, debugging, tests, and documentation. Human design contributions should be credited in the official team submission according to actual involvement.

## Roadmap

- [x] Read-only transaction verification logic
- [x] Deterministic mismatch classifications
- [x] Local case management and evidence exports
- [x] Mocked-RPC automated testing
- [ ] Document a reproducible live Devnet transaction walkthrough
- [ ] Add authenticated integrations with merchant/payment-provider systems
- [ ] Add production-grade access control and persistent storage
- [ ] Validate workflow with prospective customers

---

## Start in 3 steps

Requirements: **Node.js 22** (or a current Node.js version >=20.11). npm comes with Node. No `npm install` is needed to run the app; it has zero runtime dependencies.

**Windows PowerShell** after extracting the ZIP:

```powershell
cd "$env:USERPROFILE\Downloads\chaincase"
node --version
npm start
```

**Ubuntu / WSL** after extracting the ZIP inside your home directory:

```bash
cd ~/chaincase
node --version
npm start
```

Open **http://localhost:3000** in a browser.

Expected terminal output:

```
ChainCase ready at http://localhost:3000
```

**Check everything locally:**

```bash
npm test
npm run smoke
```

Expected: all tests pass; the smoke script prints `OK` for the frontend assets, `/api/health`, and rejects invalid transaction input. Tests use **synthetic test fixtures and a mocked RPC**, not actual token payments.

### If the server does not start

- `node: command not found`: install Node 22 LTS from https://nodejs.org/ (Windows) or use nvm in Ubuntu.
- `EADDRINUSE`: port 3000 is occupied. On macOS/Linux/WSL: `PORT=3001 npm start`; in PowerShell: `$env:PORT=3001; npm start`.
- Site loads but verifying a transaction fails: ensure outbound HTTPS can reach `https://api.devnet.solana.com`. Public endpoints can enforce rate limits, return old-history gaps or temporarily reject requests.
- A transfer to a wallet owner address is not automatically a transfer to its SPL token account. Use the actual recipient token account address.
- No uploaded CSV? Header must match precisely, and one row must have the same order ID as the case.
- Cases disappear after clearing browser data: persistence is local-only. Export your JSON first.

## Use a real transaction

1. Click **New case**.
2. Enter the expected **SPL recipient token account** (not the wallet owner), token mint, decimal amount and transaction signature.
3. Select **devnet** to begin with test assets. Use a known, finalized SPL-token transfer. A SOL-only transfer will not match.
4. Enter the separately observed merchant and provider statuses—or set them to Unknown.
5. Click **Create & verify**.
6. Inspect **Investigation** for findings, **Evidence & reconciliation** for provenance or CSV import, and **Report & export** to download a JSON investigation package or print to PDF.

To explore the workflow without a real Solana transaction, click **Explore sample case**. Every example is marked **SIMULATION**.

### CSV template

```csv
order_id,merchant_status,provider_status
INV-2026-041,FAILED,PAID
```

The input statuses are manual statements. ChainCase does not authenticate webhook signatures or attest to third-party ledger integrity.

## Architecture

```text
Browser (responsive SPA, HTML/CSS/ES modules)
 ├─ User form, cases and reports
 ├─ localStorage (local-only case history)
 ├─ deterministic analyzer (public/engine.js)
 └─ POST /api/verify
       │
       ▼
Native Node HTTP server (server/index.js)
 ├─ Input validation and request size/rate limits
 ├─ Fixed server-side RPC endpoint allowlist (devnet/mainnet-beta)
 └─ Solana RPC (server/rpc.js)
       ├─ getTransaction (finalized, jsonParsed)
       └─ getSignatureStatuses (when not returned)
```

**Why no Anchor smart contract?** The product does not move funds or enforce a payment. It needs independent historical chain verification, which is available through the existing Solana ledger. Creating a program would add attack surface without product value.

**Why no backend DB?** Scope: anonymous, solo-user hackathon demo. localStorage lets the user investigate and export locally without sign-in. Production must add authenticated multi-tenant storage, encrypted data controls and signed provider integrations.

**Why Solana is relevant:** Solana provides a publicly verifiable transaction state and SPL token transfers. An ordinary private database cannot independently prove those facts. The offchain status comparisons do not inherently require blockchain.

### Evidence states

| Classification | Interpretation |
|---|---|
| `RECORDS_ALIGNED` | Finalized matching transfer and both externally supplied statuses are PAID; third-party records not authenticated |
| `NEEDS_PROVIDER_REVIEW` | Finalized matching transfer, but at least one offchain status failed or pending |
| `MISMATCH` | Parsed transfer does not match mint, token account or expected raw amount |
| `ONCHAIN_VERIFIED` | Matching transfer, merchant/provider outcome not established |
| `ONCHAIN_FAILED` | Transaction finalized but execution failed |
| `AWAITING_FINALITY` | Signature found but not yet finalized |
| `INCONCLUSIVE` | Missing, stale or unavailable evidence; never assume the transaction failed |

## Files

```text
chaincase/
├── public/
│   ├── index.html       Responsive app shell
│   ├── app.js           UX flows, local case storage, imports and exports
│   ├── engine.js        Deterministic classification and report generation
│   ├── csv.js           CSV parser
│   ├── style.css        Responsive visual system
│   └── favicon.svg
├── server/
│   ├── index.js         HTTP server and REST routes
│   └── rpc.js           Solana RPC and SPL instruction parsing
├── tests/               Unit, API, mocked-RPC integration, bootstrap, smoke tests
├── docs/
│   ├── SECURITY.md
│   ├── DEPLOYMENT.md
│   ├── DEMO_AND_PITCH.md
│   └── SUBMISSION_AUDIT.md
├── .github/workflows/ci.yml
├── Dockerfile
├── .env.example
├── package-lock.json
└── LICENSE
```

## API contract

`GET /api/health` → `200` JSON health report.

`POST /api/verify`

```json
{"network":"devnet","signature":"<a genuine 64-byte base58 Solana signature>"}
```

Returns JSON: `source`, `state`, `signature`, `network`, `slot`, `blockTime`, `transfers[]`, `warnings[]`, `explorerUrl`. The `source` value `LIVE_RPC` means the HTTP server received a Solana RPC response; unit/integration tests label their simulated transport accordingly and do not prove live network connectivity. Invalid input → `400`, throttling → `429`, RPC failure → `503`.

`POST /api/defi/quote` accepts `{ "network":"mainnet-beta", "signature":"<base58 transaction signature>", "mint":"<SPL mint>", "destination":"<recipient token account>", "amount":"<positive raw token amount>" }`. The server independently re-verifies the transaction and matches the requested mint, recipient and raw amount against on-chain transfer instructions before requesting a quote to the USDC mint. The Jupiter request is quote-only (no `taker` parameter); the response returns indicative route/output/fee data and always marks `transactionCreated: false`. Jupiter keyless access is rate limited; the server also applies a short cooldown. Invalid input or Devnet requests return `400`, unmatched chain evidence returns `409`, and RPC/Jupiter failures return `503`.

## Limitations and threat model

Read [SECURITY.md](docs/SECURITY.md) before providing any real business data. Highlights:

- Not audited. Not for payment authorization, refunds, automatic crediting, accounting settlement or legally conclusive dispute resolution.
- No client authentication, shared case database or server-side durable storage. localStorage is accessible to browser extensions/scripts and has no strong confidentiality or integrity guarantees.
- No encrypted exports; exported JSON can include transaction and merchant context.
- No direct payer identity verification. No automatic assignment of a transaction to an order without a trustworthy binding.
- Mint metadata and branding are not verified. An SPL mint called "USDC" is not automatically real USDC.
- Requires parsed SPL-token transfers; not native SOL, compressed token transfers, exotic token extensions or smart-contract-internal accounting claims.
- RPC results depend on network and provider reliability. Multi-source RPC verification, retry queues, observability and operational auditing are future work.

## License

MIT. Created for the 2026 Colosseum Crypto World's Fair hackathon. This project does not claim endorsement by Colosseum or Solana.

## UX redesign and demo verification

See [delivery notes](docs/REDESIGN_DELIVERY.md) for changed files, 55 passing tests, responsive browser review, live Devnet verification, report artifacts and the recording workflow. The investigation interface now includes three evidence sources, contextual next steps, CSV/JSON claim imports, per-source provenance and a printable business report.
