# ChainCase

**Investigate disputed Solana payments without moving funds.**

ChainCase compares an observed finalized SPL-token transfer with an expected payment and with user-supplied merchant/payment-provider records. It identifies mismatches and exports a transparent investigation report. The system is a **read-only hackathon MVP**, not a payment processor or settlement certificate.

> **Status:** working local MVP (October 2026). No third-party provider integration or public deployment is claimed. Live public-RPC verification requires internet access from the host and a valid Solana transaction.

## Why this exists

A transaction can be finalized on Solana while a merchant's internal order system or payment provider says FAILED or PENDING. The right investigation checks the chain, then explains exactly which independent facts can be established—and which require a payment provider's own records. A transaction to a processor-controlled token account is **not proof that a merchant has been credited**.

### P0 capabilities

- Input order ID, merchant, transaction signature, expected recipient **token account**, token mint, amount and Solana cluster.
- Server-side Solana JSON-RPC `getTransaction` at `finalized`; `getSignatureStatuses` for non-finalized/unknown signatures.
- Exact raw-token-unit amounts using `BigInt`, parsed SPL `transfer` and `transferChecked` instructions (including inner instructions where parsed).
- Validate destination token account, mint and amount. Never equate a submitted signature with successful settlement.
- Compare merchant and provider statuses as **unverified third-party claims**.
- Flag amount mismatches, token mismatches, signatures shared between locally saved cases, finalized execution failures and contradictory statuses.
- Import a small CSV of order statuses (header `order_id,merchant_status,provider_status`).
- Persist cases only in the browser and export reproducible JSON/printable investigation reports.
- Three demo scenarios are possible in the codebase; the UI sample is **explicitly simulated** and not a real payment.
- Responsive dashboard, empty states, error messages, health endpoint and automated tests.

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
