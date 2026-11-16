# ChainCase security and evidence policy

## Design principle

**ChainCase investigates evidence. It must never authorize a transfer, credit an order, issue a refund or imply legal settlement.** The distinction between onchain transfer execution, provider receipt, merchant settlement and order fulfillment is fundamental.

## Assets and trust boundaries

| Source / asset | Trust level | Boundary |
|---|---|---|
| Solana finalized transaction received from configured RPC | Relatively high, contingent on RPC availability/integrity | Server retrieves directly; client cannot supply arbitrary RPC URLs |
| Expected amount, mint, destination and order ID | User-supplied | Cannot establish customer intent or merchant authorization |
| Merchant/provider PAID, FAILED, PENDING | User-supplied, unauthenticated | Never described as verified onchain fact |
| Browser localStorage | Untrusted local storage | Browser extensions, other users of the machine and device compromise can affect it |
| Exported JSON and printable report | User-controlled file | Not signed or independently tamper-evident; no certification |

## Implemented safeguards

1. Server-side allowlist of supported clusters and server-chosen RPC endpoints (no user-supplied RPC URLs/SSRF).
2. Base58 signature decoding to exact 64-byte length before any RPC request.
3. Solana transaction fetched with `commitment: finalized` and `maxSupportedTransactionVersion: 0`.
4. Execution failure causes `ONCHAIN_FAILED`; only SPL parsed transfers with a matching mint and destination are counted.
5. Monetary comparison uses integer raw units (`BigInt`), not floating point.
6. Both direct and nested parsed SPL token instructions are considered. Native SOL transfers are excluded.
7. Returns `INCONCLUSIVE` on unavailable data, instead of claiming a failed payment.
8. Request size cap (4 KB) and coarse in-memory IP rate limit (24 verification attempts/minute).
9. No private keys, seed phrases, wallet signing, custody or payment instructions.
10. No cross-origin API authorization; web assets served with CSP, `nosniff`, `DENY` frame policy and no-referrer.
11. All user-provided values in HTML templates pass through a text/attribute escaper. Explorer links are constructed from known host and escaped signature.
12. CSV import capped at 64 KB, requires expected headers, validates statuses and exact matching order ID.

## Known security gaps / production blockers

- **Unauthenticated case data.** No user accounts, roles, encryption, team collaboration, legal retention policy or data-subject controls. The interface explicitly says browser-local; do not store sensitive customer personal information.
- **Evidence not cryptographically signed.** A local user can edit browser data or an exported report. Consider signed server attestations and chain-independent verification of offchain provider records after obtaining design partners.
- **No signed PSP webhooks.** All offchain statuses are user-supplied. Never call them authenticated payments.
- **Simplified verification model.** Matching a transfer's recipient account, mint and amount to an order does not establish payer identity or exclusive attribution of a transfer to that order. A reused signature is flagged only among locally stored cases.
- **RPC trust/reliability.** A malicious or faulty upstream RPC could provide false/incomplete data. Add independently sourced confirmations and provider monitoring before production.
- **Serverless unsuitable as-is.** Native Node HTTP app requires a continuously running Node runtime or Docker hosting, not static-only hosting. Rate limiter does not persist across replicas and may treat users behind a proxy as the same IP.
- **No CSRF tokens.** Current sole mutating request is a same-origin POST that consumes network budget, not stored financial state; still add a stricter Origin check/real rate limiting for Internet scale.
- **Limited web UI test coverage.** Automated module startup and HTTP tests pass locally, but a real browser end-to-end screenshot and full accessibility audit have not been completed in this build environment.

## Security review gates before real users

- [ ] AuthN/AuthZ and role-based account access
- [ ] Secure, audited tenant-specific case storage, encryption and retention policy
- [ ] Anti-CSRF/origin checks and reverse-proxy-aware distributed rate limiting
- [ ] RPC provider hardening and additional verification for critical cases
- [ ] Client input schema validation and stronger mint/address handling
- [ ] Provider API integrations with verified webhook signatures
- [ ] Incident response, audit trail and data-subject deletion workflows
- [ ] Dependency, SAST and penetration testing
- [ ] Browser automation/accessibility tests at desktop and mobile widths
- [ ] Threat modeling including duplicated invoices, stolen keys and malicious upstream claims

No smart contract or chain program was written; there is nothing to claim as audited.
