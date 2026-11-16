# ChainCase — Week 9 project status

**Snapshot:** Reconstructed Week 9 DeFi version, verified 16 November 2026.

## Included Week 9 work

- Existing ChainCase payment investigations and finalized Solana RPC verification.
- Exact SPL token mint, recipient token account and raw amount checks.
- Browser-local case history, CSV/JSON claims, evidence export and printable report.
- Jupiter Swap API V2 quote-only integration for exact, verified mainnet transfers.
- Server-side transaction re-verification before quoting; no wallet signing, custody or swap execution.
- Week 9 documentation and laboratory report.

## Verification performed in this copy

- `npm test`: **59 passed, 0 failed**. RPC and Jupiter responses are mocked in these tests.
- `npm run smoke`: **passed** for local routes and invalid transaction handling.
- JavaScript syntax checks: **passed** for `public/app.js`, `server/index.js`, `server/jupiter.js` and `tests/jupiter.test.js`.
- `npm start`: launched; local `/` and `/api/health` returned HTTP 200.
- Week 10 analytics endpoint and dashboard stylesheet checks returned 404, as expected after removal.
- Live Solana RPC, live Jupiter quote and manual browser rendering were not tested.

## Reconstruction provenance

A standalone historical pre-Week-10 source snapshot was not available in Git history. This copy was reconstructed from the existing ChainCase application and the retained Week 9 Jupiter implementation/report. Week 10-only dashboard handlers, analytics endpoints, tests, styles, reports and screenshots were removed here. The original Week 9 + Week 10 project was kept separate and unchanged.