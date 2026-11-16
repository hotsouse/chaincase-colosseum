# Week 10 Lab Report — RPC, API and Blockchain Data

## Course and assignment

**Project:** ChainCase — Solana Payment Investigation Platform  
**Week:** 10 — RPC, API and Blockchain Data  
**Assignment:** Build a dashboard for balances, tokens, transactions, and Solana Program activity  
**Learning outcome:** RO3  
**Assessment weight:** 5%

## Project description

ChainCase is a read-only application that helps investigate Solana payment disputes. It compares user-provided payment expectations with transaction evidence retrieved from Solana RPC. Week 10 adds public wallet and program inspection to the same application so that an investigator can move from a case to related on-chain account activity.

## Objectives

- Read SOL balances and SPL token accounts from a selected Solana cluster.
- Inspect recent signatures and retrieve transaction status, fees, time, and slot where available.
- Review recent activity for any valid public program ID.
- Present network/provider status and clearly distinguish Mainnet-beta from Devnet.
- Preserve the existing investigation and Week 9 Jupiter quote workflow without wallet signing.

## Technologies

Vanilla JavaScript, HTML, CSS, Node.js native HTTP server, Solana JSON-RPC, and Node's built-in test runner. The implementation adds no runtime dependencies.

## Local application URL

Port 3000 is already occupied in the current environment. Start this project on port 3002 with `$env:PORT='3002'; npm start` in PowerShell, then open **http://localhost:3002**.

## Architecture

The browser dashboard calls same-origin `/api/analytics/*` routes. The Node server validates public addresses, selects a fixed configured RPC endpoint for Mainnet-beta or Devnet, applies timeouts and request limits, and returns normalized data. The browser displays the response without storing new case evidence. Existing cases continue to use browser localStorage.

## Implementation

The wallet view reads lamports and formats SOL using integer arithmetic. It reads token accounts from both the original SPL Token Program and Token-2022, and formats token balances from raw units and mint decimals. When the RPC response provides no verified symbol, the UI displays a shortened mint rather than inventing a token name or price.

Transaction history uses `getSignaturesForAddress` and a signature cursor for pagination. `getTransaction` is used to retrieve status, fee, slot, and parsed instruction details. If the RPC cannot supply a transaction record, the status is shown as unknown. Program Activity retrieves a recent slice of signatures for the entered program address and displays decoded instruction data when present.

## RPC methods

The dashboard uses `getBalance`, `getTokenAccountsByOwner` with `jsonParsed` encoding, `getSignaturesForAddress`, `getTransaction`, and `getSlot`. RPC calls are read-only. Standard RPC history is limited by endpoint capability and retention; it is not a full-chain index.

## Functional results

- Supports public address lookup on Mainnet-beta and Devnet.
- Displays exact SOL and token amounts, token account address, token program, and Explorer links.
- Supports original SPL Token Program and Token-2022 account queries.
- Shows recent transaction history with status, fee, slot, type when inferable, and signature pagination.
- Inspects a user-entered program ID and explains standard RPC history limitations.
- Exposes RPC network state, latest slot, and provider error messages.
- Keeps the investigation app and optional Jupiter quote workflow read-only.

## Testing results

Run `npm test`, `npm run smoke`, and `node --check` on the modified JavaScript files. Automated fixtures mock JSON-RPC; passing tests do not establish public network availability. `npm run smoke` checks local routes but does not test public RPC connectivity.

- `npm test`: **69 passed, 0 failed**.
- `npm run smoke`: **successful**; app assets, health endpoint, and invalid transaction rejection passed. The smoke script does not test public RPC.
- JavaScript syntax checks: **passed** for `public/app.js`, `server/analytics.js`, and `server/index.js`.
- Live RPC: see the final QA update below for verified Mainnet and Devnet endpoint results.
- Manual browser review and screenshot capture: **not performed**. Use the capture guide below.

## Screenshot placeholders

1. Dashboard overview: `screenshots/week10/01-dashboard.png`
2. Wallet lookup and SOL balance: `screenshots/week10/02-wallet-balance.png`
3. SPL token portfolio: `screenshots/week10/03-token-portfolio.png`
4. Transaction history: `screenshots/week10/04-transaction-history.png`
5. Program Activity: `screenshots/week10/05-program-activity.png`
6. Network information: `screenshots/week10/06-network-info.png`
7. Investigation integration: `screenshots/week10/07-investigation-integration.png`
8. Automated tests: `screenshots/week10/08-tests.png`

Capture the actual local application and terminal output. Do not use mock fixtures or sample screens as evidence of live chain results.

## Conclusion

The Week 10 dashboard brings public Solana account and transaction data into ChainCase's investigation workflow. It supports both token programs, bounded recent-history inspection, and explicit network status while avoiding wallet connection, signing, funds movement, and fabricated metadata.

## Official references

- [Solana RPC HTTP methods](https://solana.com/docs/rpc/http)
- [getBalance](https://solana.com/docs/rpc/http/getbalance)
- [getTokenAccountsByOwner](https://solana.com/docs/rpc/http/gettokenaccountsbyowner)
- [getSignaturesForAddress](https://solana.com/docs/rpc/http/getsignaturesforaddress)
- [getTransaction](https://solana.com/docs/rpc/http/gettransaction)
- [getSlot](https://solana.com/docs/rpc/http/getslot)
- [Solana RPC overview](https://solana.com/docs/rpc)
- [Jupiter Swap API (Week 9)](https://developers.jup.ag/docs/swap)

## Two-minute presentation (English)

Hello. Our project is ChainCase, a read-only Solana payment investigation platform. It helps an investigator compare a payment expectation with public blockchain evidence while keeping merchant and provider records clearly identified as external claims.

For Week 10, we added a Blockchain Dashboard to the existing application. An investigator can enter a public Solana address and select Mainnet-beta or Devnet. The dashboard reads the SOL balance in lamports and converts it exactly to SOL. It also retrieves token accounts from both the original SPL Token Program and Token-2022. Token balances are calculated from raw integer amounts and decimals, and unknown token names are shown as shortened mint addresses instead of guessed labels or prices.

The transaction section retrieves recent signatures, then reads transaction details for status, fees, slot, and parsed instruction information when available. A cursor supports loading another page. The Program Activity section accepts any public program ID and inspects a limited recent signature window. Standard RPC does not provide complete indexed history, so the interface explains that limitation.

Network health and the latest observed slot are displayed with provider errors when requests fail. We added timeouts, request limits, and mocked tests for the analytics behavior. The original ChainCase cases and optional Week 9 Jupiter quote feature remain read-only. No wallet is connected, no transaction is signed, and no funds are moved.

Thank you.

 
## Final QA update - November 13, 2026

### Cause of unknown transaction fields

The Mainnet RPC rejected getTransaction requests because the request advertised maxSupportedTransactionVersion 0; live RPC returned error -32015 and required version 1 for recent transactions. The dashboard now requests version 1, retries at confirmed commitment if a finalized lookup returns null, and paces calls per endpoint with a bounded HTTP 429 retry. Up to four transaction detail lookups run concurrently. Transaction execution status can also be taken from the err field returned by getSignaturesForAddress. Fees and transaction types stay unknown when transaction details are unavailable or cannot be reliably parsed.

### Live Mainnet RPC results

- The local HTTP wallet endpoint returned HTTP 200 for public address A1TMhSGzQxMr1TboBKtgixKz1sS6REASMxPo1qsyTSJd: 0.01 SOL, zero SPL token accounts, and one recent transaction. Its details were available: success, fee 80,000 lamports, inferred type sol_transfer. Network status was connected.
- The official SPL Token Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA returned 12 recent signatures through the local HTTP program endpoint. In the final recorded query at slot 469027766, 9 succeeded and 3 failed according to signature/transaction error data; fees were available for 10 of 12. Inferred types were 6 mixed_activity and 6 unknown. These counts are a time-slice and can change as new signatures arrive.
- The specific wallet reported to have 110 SPL accounts was not supplied in the repository or request, so that count could not be independently reproduced in this QA run.

### Devnet portfolio result

The local HTTP wallet endpoint returned HTTP 200 for 8qxqXx3GiKBSU5MwcqAwzpnKpnkMi27VULhpqnxfXwP8 on Devnet: 0 SOL and one Token Program account, mint F5PfVvib1Skj7LZqNPP5ZWirdq4jaaG2Fz4fr37NVquq, balance 5 with 6 decimals. This is Devnet test data, not a real-value asset.

### Regression checks and limitations

- Final npm test: 69 passed, 0 failed; includes existing Jupiter quote/API and JSON report-export tests.
- Final npm run smoke: passed; its output correctly states it does not test public RPC.
- node --check passed for modified JavaScript files.
- No WEEK9-BONK-001 transaction or Mainnet case record is stored in this repository. Week 9 behavior remains covered by mocked tests, but this run could not re-query that case or obtain a live Jupiter quote.
- No manual browser review or screenshots were completed. Standard RPC history remains a recent provider-queryable slice; fee/type can stay unknown when details are unavailable.

This QA instance is running at http://localhost:3002 because ports 3000 and 3001 were already occupied.

