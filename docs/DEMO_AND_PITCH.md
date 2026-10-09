# ChainCase — Colosseum demo and pitch kit

## Submission dates and facts to verify immediately

Official Crypto World's Fair page: https://colosseum.com/worldsfair . Its published product-submission deadline is **October 12, 2026**. Join the competition and verify the portal's precise timezone and actual checklist before uploading. Do not confuse earlier fall-Solana-hackathon schedule announcements with this later competition.

Colosseum page: https://colosseum.com/hackathon . Official rules: https://colosseum.com/legal/Crypto%20World%27s%20Fair%20Hackathon%20Rules.pdf . The README and this submission kit are not substitutes for current platform instructions.

## Identity

**Product:** ChainCase

**Tagline:** Verify the chain. Reconcile the story.

**One line:** An independent, read-only investigation layer that compares finalized Solana token transfers with conflicting merchant and provider statuses and exports an evidence-based case report.

**Customer:** Small crypto SaaS businesses, digital merchants and payment integration teams already accepting Solana SPL tokens.

**Problem:** Onchain transfers, provider ledgers and store order states can disagree, forcing support and operations teams to manually investigate disparate records.

**Why Solana:** A verifiable finalized transaction and exact SPL-token transfers are independent public evidence unavailable from a centralized checkout database alone.

**What it does NOT do:** Send money, issue refunds, confirm a provider credited a merchant, verify identity, or certify settlement.

## Live demo script, target 2–3 minutes

**00:00–00:20 — show the problem**

> "A customer says they paid. Their Solana transaction is finalized. But the merchant's checkout still reports FAILED. Who is right? One status doesn't tell the whole story."

**00:20–00:35 — dashboard**

Show dashboard and its visible disclaimer: read-only, no custody. Say ChainCase resolves ambiguity by separating onchain evidence from offchain claims.

**00:35–01:10 — real verifier**

Create a case with a **genuine finalized devnet SPL-token transaction**, destination token account, mint and exact amount. Click **Create & verify** and show the RPC evidence (slot, transfer, mint, amount). If no valid devnet transaction is available, do **not** pretend the simulated fixture is live. Show the labeled simulation and explicitly state public-RPC connectivity is not yet verified.

**01:10–01:35 — conflicting statements**

Open Evidence & reconciliation. Show merchant FAILED and provider PAID. Explain both are imported claims, not trusted attestation. Optionally import a small CSV of status records and show the specific conflict.

**01:35–02:00 — classification and report**

Switch to Investigation. Show NEEDS_PROVIDER_REVIEW, its specific explanation and why an onchain transfer is not automatic proof of settlement. Then click Report & export → Download evidence JSON / Print.

**02:00–02:20 — commercial angle**

> "We start with the recurring operational failure behind crypto payments: inconsistent states across systems. Instead of replacing a payment provider, we provide a portable investigation record. Our pricing and demand hypotheses will be validated through merchant pilots."

**02:20–02:40 — next steps**

> "We will add verified provider integrations and time-to-resolution measurement only once customers demonstrate frequent, costly incidents. No token and no custody are required."

## 30-second elevator pitch

> "A blockchain payment can succeed while a merchant's system says it failed. ChainCase helps teams investigate that gap. It retrieves finalized Solana transfer evidence, compares it with merchant and provider records, flags contradictions and produces a clear report showing what is known and what remains unverified. We never move money. Our goal is to make crypto payment incidents easier to resolve without blindly trusting a single system."

## Judge Q&A — defensible answers

**Q: Why not use a payment gateway's existing dashboard?**

A: Gateways already cover much of payment processing and reconciliation. Our hypothesis is that merchants using multiple systems need an external, portable incident dossier. This differentiation is only partially implemented in the MVP; provider-specific integrations and willingness to pay remain unvalidated.

**Q: Why Solana?**

A: We read finalized transactions and parsed SPL-token transfer instructions; the shared public ledger provides an independently inspectable record. We do not add an unnecessary smart contract.

**Q: Can you prove the merchant received the money?**

A: No, not from an SPL transfer alone. It can prove a transfer to the recorded destination token account, but provider credit, merchant account settlement and order fulfillment require separate evidence. The app explicitly says so.

**Q: Why will buyers pay?**

A: Unknown. The pricing model is a hypothesis. We need firsthand cases, measured investigation time and paid pilot commitments; none are claimed as achieved.

**Q: What is hard to copy?**

A: The current code is not hard to copy. The potential differentiated asset is multi-provider integrations and an evidence schema trusted by operations teams. This is a roadmap, not existing defensibility.

**Q: Does it involve custody or financial advice?**

A: No. No wallet connection, signing, transaction construction, asset holding or refund execution.

**Q: How do you handle scams?**

A: Our tool never recommends a recipient or authorizes transfers. It simply inspects a transaction and external records. It cannot verify the legal identity of a recipient.

**Q: What actually works today?**

A: Local creation of investigations, server-side Solana RPC verification code, exact SPL transfer parsing, evidence reconciliation, CSV import, browser-local saved history and report export. Unit, mocked-RPC integration and HTTP smoke tests have run. A live public RPC transaction and a public deployment are not claimed tested yet.

## Market entry and validation

**Hypothetical pricing:** pay-per-case $19; team tier $79 per month. These are NOT validated prices or signed contracts.

**First customers to contact:** Four small Solana-accepting SaaS or merchants, three Web3 agencies/bookkeepers, and three teams integrating payment providers. Contact via relevant founder communities, technical GitHub issue discussions and payment-ops networks. Record interviews, dates, roles, recurring frequency and anonymized concrete incident examples.

**Questions:** What happened in the last discrepant payment? When? How many in 30 days? Who investigated? How many minutes/hours? Which systems? What did it cost? Can we replay an anonymized case? Who owns the budget? Would a paid pilot be worth $49–79 if it reduced the work?

**Reject the idea if:** no recent incidents, negligible expense, existing dashboards solve the whole problem, or no buyer agrees to serious pilot discussions.

**Metrics to measure later:** median investigation minutes per case, true-positive mismatch rate, false-positive rate, percentage of incidents resolved with sufficient evidence and gross revenue retention. Do not fabricate these measures at submission.

## Source links for public claims

- Official hackathon: https://colosseum.com/worldsfair
- Official program FAQ: https://colosseum.com/hackathon
- Solana RPC getTransaction: https://solana.com/docs/rpc/http/gettransaction
- Solana SPL token mechanics: https://solana.com/docs/tokens

## Demo recording checklist

- [ ] Exact required video length checked in submission portal
- [ ] Screen recording shows real browser interaction rather than animations
- [ ] Real network verification is shown only if it happened successfully
- [ ] Simulation labels are legible if using simulated cases
- [ ] No customer names, sensitive data, private keys or API tokens visible
- [ ] Network, mint, token-account distinction and status wording explained
- [ ] Report export actually produces a file in the recording
- [ ] Closing slide or final sentence names customer, wedge and roadmap
- [ ] Spoken claims match README, code and any cited customer research
