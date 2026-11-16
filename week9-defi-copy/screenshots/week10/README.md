# Week 10 Screenshot Capture Guide

In this environment, start the application with `$env:PORT='3002'; npm start` and open `http://localhost:3002` (ports 3000 and 3001 are already occupied). These are capture instructions only; no screenshot or live chain result is fabricated.

1. **01-dashboard.png** — Open **Blockchain Dashboard** before lookup; capture the dashboard heading, wallet/program forms, and network information state.
2. **02-wallet-balance.png** — For a reproducible Devnet example, enter `8qxqXx3GiKBSU5MwcqAwzpnKpnkMi27VULhpqnxfXwP8`, click **Inspect wallet**, and capture the address, cluster, SOL balance, and refresh time. It returned 0 SOL and one token account in a live read-only check on November 12, 2026; RPC data can change.
3. **03-token-portfolio.png** — Reuse the Devnet address from step 2. Its live lookup returned one Token Program account for mint `F5PfVvib1Skj7LZqNPP5ZWirdq4jaaG2Fz4fr37NVquq`, balance 5 with 6 decimals, on November 12, 2026. Capture the mint, shortened symbol, balance, decimals, token account, program, and Explorer link; the result may change.
4. **04-transaction-history.png** — Use an address with recent transactions; capture signatures, dates, statuses, fees, slots, and the **Load more transactions** control if another page is available.
5. **05-program-activity.png** — Enter the official SPL Token Program ID `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`, choose Devnet, and click **Inspect program**. Capture the recent signature rows and the visible RPC history limitation note. Results depend on endpoint availability.
6. **06-network-info.png** — Capture active cluster, RPC status, latest slot, last successful refresh, and any provider error. To demonstrate the error state, use a temporarily unavailable endpoint only in a local test environment and restore configuration afterward.
7. **07-investigation-integration.png** — Open an existing case, select the dashboard from navigation, and capture the prefilled recipient token account and cluster. Return to the case and capture its preserved investigation state.
8. **08-tests.png** — In a terminal at the repository root, run `npm test`; capture the summary with pass/fail counts. This is mock/automated evidence, not proof of live chain access.

Use the operating system's screenshot shortcut or browser capture tool. Keep full relevant values visible when appropriate, but do not expose private information. Include only genuine output from this running app. A blank or empty account is a valid result when it is the account actually queried.


