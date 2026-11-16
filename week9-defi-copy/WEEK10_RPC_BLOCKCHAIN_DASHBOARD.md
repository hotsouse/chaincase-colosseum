# Week 10 — RPC, API and Blockchain Data

## 1. Introduction

ChainCase is a read-only Solana payment investigation tool. Week 10 adds a public-address analytics dashboard to the existing vanilla JavaScript application and Node.js HTTP backend. It reads account balances, SPL token accounts, recent signatures, transaction details, program activity, and cluster health. It does not connect a wallet, request a signature, or submit a transaction.

## 2. Official Week 10 objective

**Topic:** RPC, API and Blockchain Data. **Assignment:** create a dashboard displaying balances, tokens, transactions, and Solana Program activity. **Learning outcome:** RO3. **Assessment weight:** 5%.

## 3. Solana RPC and blockchain APIs

Solana JSON-RPC uses HTTP POST requests with JSON-RPC 2.0. Each endpoint is tied to a cluster, so an address lookup must specify Mainnet-beta or Devnet. RPC responses describe public chain state at the queried commitment; provider availability, rate limits, ledger retention, and parsed-transaction support affect what can be retrieved.

## 4. Existing and new architecture

The existing app remains a small, dependency-free stack: responsive HTML/CSS, vanilla JavaScript, browser-local case history, and a Node.js HTTP server. The dashboard UI is in `public/app.js` and `public/dashboard.css`. The analytics service in `server/analytics.js` calls the selected Solana RPC endpoint. `/api/analytics/*` routes validate and rate-limit requests. RPC endpoints and credentials remain server-side.

## 5. RPC methods used

- `getBalance` reads SOL in lamports; the UI converts the integer amount to SOL without floating-point arithmetic.
- `getTokenAccountsByOwner` with `jsonParsed` encoding reads accounts separately for the original SPL Token Program and Token-2022. Token balances are formatted from raw integer units and mint decimals.
- `getSignaturesForAddress` retrieves recent signatures and supports the `before` pagination cursor.
- `getTransaction` supplies parsed transaction status, fee, slot, and instructions. Unknown or unavailable details remain labeled unknown.
- `getSlot` supplies the latest observed slot for network status.

The implementation does not call `getBlockTime`; timestamp data comes from the RPC signature row's `blockTime`. It does not use `getAccountInfo` because the requested wallet and token views are adequately provided by the methods above.

## 6. Wallet balance retrieval

The user enters a 32-byte base58 public address. The backend validates it, requests `getBalance`, and returns both raw lamports as a decimal string and an exact SOL string. Last refresh is recorded only after a successful wallet query. The Explorer link uses the selected cluster.

## 7. SPL token portfolio

The backend queries each supported token program and combines the returned parsed accounts. Each row includes mint, raw amount, exact decimal balance, decimals, token account, owning token program, and an account Explorer link. RPC account data does not establish a trustworthy display name or market value, so absent verified symbols are represented by a shortened mint. There are no prices and no guessed metadata. A wallet with no token accounts receives an explicit empty state.

## 8. Transaction history

The dashboard shows recent signature, time when available, transaction status, fee in lamports, slot, a conservative transaction type, and an Explorer link. It retrieves at most 12 signatures per page by default (up to 20 server-side). “Load more transactions” passes the last signature as `before` and appends non-duplicate results. Transaction-detail requests run with bounded concurrency. RPC errors do not become empty-history success; transaction-detail gaps remain unknown.

## 9. Solana Program Activity

Users can enter any valid public program ID. No ChainCase deployed program is configured, so the dashboard does not invent one. The initial demonstration value is the public SPL Token Program address. Program history uses `getSignaturesForAddress`, then fetches the recent transaction details and displays relevant instruction entries when parsed data is available.

Standard RPC returns only a recent provider-queryable slice and does not guarantee complete historical coverage. Parsed instruction details may be absent, especially for custom programs or unsupported transaction versions. A third-party indexer is optional and would be needed for broader historical search, indexed instruction decoding, and analytics across the full ledger.

## 10. Investigation integration

The existing case navigation is preserved. When a case is open, the dashboard wallet field is prefilled with its recipient token account and network; the dashboard provides a return-to-case control. The account table links token accounts to Explorer, and recent transaction rows link signatures to Explorer. Existing case evidence and Week 9 Jupiter quote behavior remain case-scoped and unchanged. Jupiter is not queried for every portfolio token, and historical Week 9 quote data is not presented as a current token price.

## 11. Security and data accuracy

- Only public addresses are accepted. Never enter a seed phrase, private key, or wallet password.
- The application uses read-only JSON-RPC requests. No signing or transaction submission is implemented.
- Lamports and token raw units are retained as integer strings; no floating-point amount conversion is used for these balances.
- Network/provider errors, rate limits, and request timeouts are surfaced. API requests are limited per client IP, and transaction-detail calls are concurrency bounded.
- Wallet results are tied to the current address/network, so a slower earlier response cannot replace a newer lookup.
- SPL token symbols and token prices are not inferred from untrusted mint data. Jupiter quotes are still an explicit, case-related Week 9 action.

## 12. Testing results

`npm test` runs the existing Week 9 and investigation tests plus mocked analytics tests. The analytics tests cover exact lamport conversion, Token-2022 and original token program retrieval, raw token formatting, pagination, unsupported networks, RPC/provider errors, program activity, and HTTP API responses. These are mocked tests, not evidence of live RPC availability. `npm run smoke` checks the local app routes and invalid transaction handling; it explicitly does not test public RPC connectivity. JavaScript syntax checks use `node --check`.

Final QA on November 13, 2026: npm test passed 69/69; npm run smoke passed; JavaScript syntax checks passed. Live results and limitations are recorded in WEEK10_LAB_REPORT.md.

## 13. Limitations

- Public RPC providers can rate-limit, time out, prune history, or omit parsed details. Wallet and program histories are not exhaustive.
- This MVP has no indexing service, metadata registry, price feed, authentication, or server-side case database.
- Token accounts and mints are public chain data; a token symbol or familiar-looking mint alone would not prove token identity.
- Transaction type is intentionally limited to what can be inferred from parsed System/SPL Token instructions. Other activity is `unknown`.
- Mainnet and Devnet are separate ledgers. An address with activity on one cluster can be empty on the other.

## 14. Run the project

Requirements: Node.js 20.11 or newer. No dependency installation is needed.

```powershell
cd C:\Users\uldan\Downloads\chaincase-backup-20261102-131143
$env:PORT='3002'
npm start
```

In this environment port 3000 is already occupied, so use `http://localhost:3002`. Choose **Blockchain Dashboard**, enter a public address, select its cluster, and choose **Inspect wallet**. Enter a program ID and choose **Inspect program** to review its recent activity. Use **Load more transactions** for the next signature page. Do not treat the demo token program's complete history as available.

Run checks from a second terminal:

```powershell
npm test
npm run smoke
node --check public/app.js
node --check server/analytics.js
node --check server/index.js
```

### Live RPC example

On November 12, 2026, the dashboard analytics service successfully queried Devnet for wallet `8qxqXx3GiKBSU5MwcqAwzpnKpnkMi27VULhpqnxfXwP8`. The live response reported 0 SOL, one Token Program account for mint `F5PfVvib1Skj7LZqNPP5ZWirdq4jaaG2Fz4fr37NVquq` with balance 5 and 6 decimals, and one transaction detail row. The same run retrieved recent signature rows for the official SPL Token Program ID `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`. This is Devnet test data, not a real-value asset or permanent availability guarantee. The wallet is a public address; no signing or write request was made.

## 15. Screenshot evidence

Save genuine application captures as `screenshots/week10/01-dashboard.png` through `08-tests.png`. Use live RPC results only when the selected public endpoint responds. Keep errors visible when demonstrating provider failure; do not replace them with invented balances or transactions. Exact capture steps are in `screenshots/week10/README.md`.

## 16. Official documentation

- [Solana JSON-RPC HTTP methods](https://solana.com/docs/rpc/http)
- [getBalance](https://solana.com/docs/rpc/http/getbalance)
- [getTokenAccountsByOwner](https://solana.com/docs/rpc/http/gettokenaccountsbyowner)
- [getSignaturesForAddress](https://solana.com/docs/rpc/http/getsignaturesforaddress)
- [getTransaction](https://solana.com/docs/rpc/http/gettransaction)
- [getSlot](https://solana.com/docs/rpc/http/getslot)
- [Solana RPC overview and clusters](https://solana.com/docs/rpc)
- [Jupiter Swap API overview (Week 9)](https://developers.jup.ag/docs/swap)

## 17. Conclusion

Week 10 extends ChainCase with a read-only dashboard for wallet balances, SPL and Token-2022 accounts, recent transaction history, program activity, and RPC network status. It connects these views to the existing investigation workflow while retaining ChainCase's evidence limits and no-signing behavior.

 
## 18. Final QA: transaction details and live Mainnet

Live Mainnet getTransaction calls initially failed for version-1 transactions because the client advertised support only through version 0. The RPC response required maxSupportedTransactionVersion 1. The analytics client now requests version 1 and retries a null finalized result at confirmed commitment. getSignaturesForAddress execution errors supply a known success/failure status when transaction details cannot be fetched; fee and type remain unknown without details. The service paces JSON-RPC calls per endpoint, bounds detail lookup concurrency at four, and retries one HTTP 429 after a short delay.

Live verification through the local HTTP endpoints returned HTTP 200 on Mainnet for wallet A1TMhSGzQxMr1TboBKtgixKz1sS6REASMxPo1qsyTSJd (0.01 SOL, zero SPL accounts, one successful SOL transfer; fee 80,000 lamports) and 12 recent SPL Token Program signatures. In the final recorded program query at slot 469027766, 9 signatures succeeded and 3 failed; 10 fees were available; inferred types were 6 mixed-activity transactions and 6 unknown. These counts are a time-slice and can change as new signatures arrive. A separate Devnet portfolio lookup returned one actual token account with balance 5 at 6 decimals. The wallet said to have 110 SPL accounts was not supplied, so that specific count was not independently checked.

Automated final QA: npm test 69 passed/0 failed; npm run smoke passed; node --check passed for public/app.js, server/analytics.js, and server/index.js. Existing Jupiter quote/API and JSON report export tests passed. No WEEK9-BONK-001 transaction is stored in this repository, so no live quote for that case was retried. No manual browser review or screenshots were performed.

References: https://solana.com/docs/rpc/http/gettransaction accepts maxSupportedTransactionVersion; https://solana.com/docs/rpc/http/getsignaturesforaddress returns each signature's err value.
