# Week 9 — DeFi on Solana

## 1. Objective

Week 9 studies a real Solana DeFi protocol and integrates a useful DeFi data point into the existing ChainCase payment investigation workflow. ChainCase remains an evidence tool: this integration does not custody assets, authorize a payment, or establish merchant settlement.

## 2. DeFi on Solana

Solana DeFi applications expose liquidity, pricing and transaction operations through on-chain programs and off-chain APIs. A swap aggregator searches supported liquidity sources and produces a route between token mints. A quote describes a possible conversion for a particular input amount at request time. It can change with liquidity, route availability and market conditions. A quote is not proof that a transfer happened, nor a guarantee of the amount a user would receive later.

## 3. Selected protocol: Jupiter Swap API V2

ChainCase uses Jupiter's official Swap API V2 `GET /swap/v2/order` endpoint in quote-only mode. Without a `taker` parameter, Jupiter returns a quote and does not assemble a wallet transaction. The request is routed from the verified SPL-token mint to the official Solana USDC mint. Jupiter documents keyless requests for prototyping and an API-key option for higher production limits. This project uses no API key and therefore remains subject to Jupiter's published keyless rate limit.

Official references:

- [Jupiter Swap API overview](https://developers.jup.ag/docs/swap)
- [Jupiter Order endpoint reference](https://developers.jup.ag/docs/api-reference/swap/order)
- [Solana `getTransaction` RPC method](https://solana.com/docs/rpc/http/gettransaction)

## 4. Why Jupiter fits ChainCase

ChainCase investigates SPL-token payment incidents. A verified transfer may use a token whose current market value helps an investigator understand the size of the asset involved. The quote is optional context attached to a case; it does not affect the mismatch classifier, evidence status or recommended action. Adding a signer or swap execution flow would cross ChainCase's documented no-custody, no-transfer product boundary, so the integration stops at a real read-only quote.

The quote is only offered when all these conditions hold:

- The case is not a simulation.
- The selected cluster is `mainnet-beta`.
- The case has live Solana RPC evidence.
- The finalized transaction contains matching transfers for the expected mint and destination, and their total equals the expected amount.

Devnet cases are not sent to Jupiter because the quote endpoint describes mainnet liquidity. Synthetic examples use fake identifiers and never reach the protocol.

## 5. Integration architecture

```text
Case investigation UI
  └─ explicit “Get Jupiter quote” action
       └─ POST /api/defi/quote { network, mint, amount }
            ├─ validate mainnet, base58 mint, positive raw integer amount
            ├─ apply short request cooldown
            └─ GET https://api.jup.ag/swap/v2/order
                 ├─ inputMint = verified case mint
                 ├─ outputMint = Solana USDC mint
                 ├─ amount = sum of matching on-chain raw transfer amounts
                 └─ no taker parameter → quote only
```

The browser never calls Jupiter directly and receives no API secret. Before requesting a quote, the server independently re-fetches the submitted signature through its configured Solana RPC and matches the requested mint, destination and summed raw amount against the parsed on-chain transfers. The quote is held in page memory and is not written into browser case history or exported as blockchain evidence.

### Data boundaries

| Data | Source and storage |
| --- | --- |
| Signature, network, mint, destination, raw transfer amount | Public Solana transaction; existing verifier and local case record |
| Indicative USDC output, quoted fee and router | Live Jupiter API response; displayed in current page memory only |
| Merchant/provider statuses | User-entered or imported off-chain claims, unchanged |
| Wallet address, signature or private key | Not requested or used |

## 6. Technologies and dependencies

- Existing Node.js native HTTP server (`server/index.js`)
- Existing HTML/CSS/vanilla JavaScript app (`public/`)
- Native Node `fetch`, `URL`, `AbortController`, and `BigInt`
- Jupiter Swap API V2; no additional npm dependencies
- Node.js built-in test runner with mocked Jupiter and RPC responses

No Rust program, Anchor framework, wallet adapter, database, or smart contract was added because quote-only market context does not need a custom on-chain program or a signing wallet.

## 7. Implementation steps

1. Verify and exactly match a finalized SPL-token transfer using ChainCase's existing Solana RPC path.
2. On the case overview, explicitly request a quote for the summed raw amount of transfers matching the case mint and destination.
3. The backend validates the network, mint and raw amount and calls Jupiter's quote endpoint with the case mint and USDC output mint.
4. The UI formats Jupiter's output as USDC, identifies the quoted route and fee, and shows the quote time and limitations.
5. If Jupiter is unavailable or has no route, the UI shows an error without substituting a mock price or fabricated output.

## 8. Important code

- `server/jupiter.js`: validates quote input, calls the official V2 endpoint, applies a timeout, rejects malformed or missing route responses, and explicitly returns `transactionCreated: false`.
- `server/index.js`: exposes `POST /api/defi/quote`, validates input before applying a two-second cooldown, and returns safe errors.
- `public/app.js`: displays the quote feature only for exact live mainnet matches, calculates matching raw units with `BigInt`, and handles loading, success and error states.
- `public/style.css`: styles the responsive quote card to fit ChainCase's current visual system.
- `tests/jupiter.test.js` and `tests/http.test.js`: verify quote input validation, endpoint construction, quote-only behavior and API routing using mocks.

## 9. Run and test

The project has no added package dependency. From the repository root:

```sh
npm start
npm test
npm run smoke
```

Open `http://localhost:3000`. For the DeFi context demonstration, create or open a case on `mainnet-beta` with a real finalized SPL-token transfer, verify that the expected mint, token account and amount match, then choose **Get Jupiter quote** in the case overview. A Devnet case or sample case will explain why no quote is available.

## 10. Security considerations

- The operation is quote-only. The request omits `taker`; the backend neither asks for wallet credentials nor assembles, signs, or submits a transaction.
- The app does not make transfer, approval, swap, or paid transaction calls.
- Only `mainnet-beta` is accepted; signature, mint and destination use exact-length Solana base58 address validation. The backend re-verifies the transaction and checks the requested mint, destination and amount against parsed transfers instead of trusting browser-local case evidence.
- Amount must be a positive raw integer string; it is derived from verified transfer instructions using `BigInt`, not floating-point math.
- Jupiter receives the public mint and amount only. ChainCase uses the transaction signature with its own Solana RPC verifier; the signature, business/order data and wallet address are not sent to Jupiter.
- Fetch uses a timeout; HTTP errors, rate limits, missing routes and malformed data do not become a balance or quote.
- A quote is current market context, not historical evidence, settlement proof, or an execution guarantee.
- Jupiter keyless usage is rate-limited by the provider. The backend adds a small cooldown, but production use should configure a provider API key outside the frontend and add deployment-grade per-client throttling and monitoring.

## 11. Testing results

Results from this workspace after implementation:

- `npm test`: **59 passed, 0 failed**. Tests use synthetic data and mocked RPC/Jupiter responses; no live quote is implied.
- `npm run smoke`: **passed** for static routes, health endpoint and invalid-signature rejection. It explicitly does not test public RPC connectivity.
- `npm start`: server launched successfully; local `GET /` returned **200** and `/api/health` reported ChainCase in read-only mode.
- `node --check public/app.js`, `node --check server/index.js`, `node --check server/jupiter.js`: **passed**.
- Live Jupiter quote, live Solana mainnet RPC and manual browser rendering were **not tested** in this run.

## 12. Week 9 completion and remaining limits

Completed: a genuine Jupiter Swap API V2 quote-only integration, an explicit DeFi context panel, server-side validation and timeout, real-data eligibility rules, honest Devnet/demo behavior, API and unit tests, and documentation. The existing investigation, reconciliation, CSV, report and Solana verification workflows remain in place.

Limitations: a quote is not a historical token valuation; the current version uses Jupiter's quote-only keyless API and may be rate-limited; there is no wallet connection or swap execution; and live provider connectivity and manual browser acceptance still need to be checked on a networked machine. No real funds are required for the automated tests, but a live market quote requires a reachable Jupiter API and a real matching mainnet transaction in the app.

## Suggested 1–2 minute presentation

> ChainCase is a read-only Solana payment investigation tool. It checks finalized SPL-token transactions and compares the mint, receiving token account and exact token amount with an order expectation. For Week 9, I integrated Jupiter Swap API V2 to add current DeFi market context to a verified payment. When a real mainnet transfer matches exactly, an investigator can request an indicative quote for converting that token amount to USDC. The quote comes from Jupiter's live routing API and includes the route and fee information. It is clearly separated from blockchain evidence: it is not a historical valuation, does not prove merchant settlement and is not guaranteed to execute. The integration is quote-only, so it does not ask for a wallet, create a transaction, or move funds. Devnet and sample cases are not sent to Jupiter. The tests cover validation, API behavior and failures using mocks; a live network quote and manual browser review remain to be completed in a connected environment.
