# Week 9 Submission Report — ChainCase

**Checked:** 11 November 2026  
**Project:** ChainCase 0.1.0  
**Purpose:** Document the Week 9 Jupiter Swap API V2 integration and the checks run in this workspace.

## Summary

ChainCase's Week 9 feature is an optional, read-only Jupiter Swap API V2 quote for USDC. It is only available for a non-simulated case on `mainnet-beta` with a successful finalized live-RPC verification and an exact match between the case's SPL-token mint, recipient token account, and summed raw transfer amount. The Jupiter request has no `taker`; the application does not create, sign, or submit a transaction.

No eligible, real mainnet case was supplied for this check, so **no live Jupiter quote was requested or verified**. No transaction data or quote output has been fabricated. The supplied QA live-case record is marked `devnet`, so it is not eligible for Jupiter.

## Starting the application

From the project directory in Windows PowerShell:

```powershell
node --version
npm start
```

The project requires Node.js `>=20.11.0`; this workspace has Node.js `v24.19.0` and npm `11.17.0`. No dependency installation is needed for this zero-dependency project. The default local URL is:

**http://localhost:3000**

The server's health endpoint is `http://localhost:3000/api/health`; a healthy response includes `{"ok":true,"product":"ChainCase",...}`.

During this check the health endpoint returned **HTTP 200** and identified ChainCase. Port 3000 was already occupied, so a second `npm start` attempt returned `EADDRINUSE`; the existing listener was not stopped or modified. If that happens on your machine, use the browser at the URL above if it is your ChainCase instance, or stop the process you own that is using port 3000 before starting ChainCase. Do not terminate an unknown process.

## Automated checks performed

Commands run from the project root:

```powershell
npm test
npm run smoke
```

Results:

- `npm test`: **59 passed, 0 failed**.
- `npm run smoke`: **passed**. The script checked `/`, `/app.js`, `/engine.js`, `/csv.js`, `/style.css`, `/favicon.svg`, `/api/health`, and rejection of an invalid transaction signature.
- The smoke script explicitly does **not** test public Solana RPC connectivity.
- Jupiter tests in the suite use mocked responses. They verify validation, the official V2 endpoint URL, no `taker` parameter, quote-only response behavior, and error handling. They do **not** prove Jupiter or live RPC connectivity.
- No live Solana mainnet verification or live Jupiter quote was performed; no claim that either live API test passed is made.

## Jupiter eligibility and safe testing steps

You do **not** need to send funds to exercise a quote for a transaction that already exists. Use an existing finalized mainnet SPL-token transfer for which you have the correct public transaction details and are authorized to investigate. The app is read-only; it only queries RPC and, if all checks pass, requests an indicative quote.

1. Start ChainCase and open **http://localhost:3000**.
2. Select **Investigations** and open an existing case only if it is a real case on `mainnet-beta`, not marked as a simulation, and has `LIVE_RPC` evidence in `FINALIZED_SUCCESS` state. The saved Devnet QA case and any **sample/demo** case are not eligible.
3. If creating a case, select **New case** and enter the actual merchant/order context, the expected token amount in decimal token units, and select **Mainnet beta · read-only**.
4. Enter the signature of the **existing** mainnet transaction, the receiving SPL token account (not merely the wallet-owner address), and the mint address for the token that was actually transferred. These values must come from the real transaction and a trusted source; do not copy fixture values or make up identifiers.
5. Select **Create & verify case**. This performs read-only verification. For Jupiter eligibility, the result must show successful finalized `LIVE_RPC` evidence and a matching transfer whose mint and recipient account match the case and whose total amount exactly equals the expected amount.
6. In that case overview, choose **Get Jupiter quote** if the control is available. The server independently re-verifies the transaction and matching raw amount before asking Jupiter for a quote to Solana USDC. The request can fail if RPC/Jupiter is unreachable, rate-limited, or has no route; report the actual result without substituting a sample quote.

For a quote request, both network services must be reachable: the configured Solana RPC must verify the transaction, and Jupiter's quote endpoint must return a usable route. The quote is current indicative market context, not a historical valuation, settlement proof, or guarantee of later execution.

## Screenshot folder and capture checklist

The folder `screenshots/week9/` is prepared. Screenshots have **not** been captured in this run. Save authentic screenshots there using these suggested filenames:

1. `01-dashboard.png` — ChainCase overview at the local URL.
2. `02-new-mainnet-case.png` — New-investigation form with **Mainnet beta · read-only** selected. Avoid exposing unrelated personal data.
3. `03-live-verification.png` — Actual finalized mainnet verification for an existing transaction. Do not use a simulated or Devnet case as live evidence.
4. `04-jupiter-eligibility.png` — The real case overview showing the verified mint, destination/amount match, and Jupiter quote action.
5. `05-jupiter-response.png` — The actual quote response, or the actual error if the live request fails. Do not create or edit quote values.
6. `06-tests-and-smoke.png` — Terminal showing the completed `npm test` and `npm run smoke` results.

Only capture items 3–5 if a real eligible mainnet case is available. If not, leave those screenshots uncaptured rather than presenting a fixture as live evidence. Never include API keys, private keys, seed phrases, or other secrets in screenshots.

## Code references

- `server/jupiter.js` validates quote inputs and calls Jupiter Swap API V2 without a `taker`.
- `server/index.js` verifies the mainnet transaction and matching transfer before requesting a quote.
- `public/app.js` only offers the quote for eligible, non-simulation live cases.
- `tests/jupiter.test.js` and `tests/http.test.js` cover mocked quote and API behavior.
- `WEEK9_DEFI.md` describes the integration, constraints, and presentation notes.

