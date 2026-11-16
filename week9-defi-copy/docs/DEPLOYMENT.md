# Deployment guide

## Local Windows / WSL

From extracted `chaincase` folder run `node --version` (>=20.11; Node 22 recommended), then `npm start`. Open http://localhost:3000. Run `npm test` and `npm run smoke` before demo recording.

Windows PowerShell:

```powershell
cd "$env:USERPROFILE\Downloads\chaincase"
npm start
```

Ubuntu/WSL:

```bash
cd ~/chaincase
npm start
```

If using WSL and accessing from Windows, `http://localhost:3000` normally forwards automatically. If not, check that your distribution is running and its firewall policies.

## Recommended production-like host

The MVP runs as a plain Node HTTP process. Choose a **Node web-service hosting** service (e.g., Render or Railway) or container host; do not deploy `public/` alone. Those provider names are examples, not claims of a free tier or verified deployment.

For a GitHub deployment:

1. Create a new empty GitHub repository and push the contents of this directory.
2. Create a new Node Web Service with the repository as source.
3. Set **Start Command** = `npm start`. The platform should supply `PORT`; the server listens on `0.0.0.0`.
4. Set optional environment variables from `.env.example`, replacing URLs with trusted operator-controlled RPC endpoints if desired. Do not put secrets in any public file or `VITE_`/`NEXT_PUBLIC_` prefixed variable.
5. Enable HTTPS and verify `GET /api/health`, `/app.js`, `/engine.js`, `/csv.js`, and `/style.css`.
6. Use a finalized Solana devnet SPL transfer to manually verify the first real read-only case before recording a public demo.

No managed database setup is needed. **Cases stay in each browser, not the hosting provider.**

## Docker

```bash
docker build -t chaincase .
docker run --rm -p 3000:3000 chaincase
```

Docker image uses `node:22-alpine`, includes source files only, runs under the unprivileged `node` account and exposes port 3000. Container build was not tested in this environment because a Docker daemon is not available here.

## Runtime checks

```bash
curl -fsS http://localhost:3000/api/health
curl -I http://localhost:3000/app.js
```

Expect a JSON `ok:true` health status and HTTP 200 for static assets. A healthy local server does **not** prove it can reach public RPC from a cloud host. Check the browser Network panel during a legitimate devnet verification.

## RPC and rate limiting

Use `SOLANA_DEVNET_RPC` for a managed devnet RPC endpoint if the public endpoint throttles your app. The URL is read from server environment only; never expose API keys in screenshots, logs or public repository.

Rate limiting is an in-memory per-IP threshold in this MVP, not a robust distributed security mechanism. For a production deployment add edge/proxy controls, logging with redaction, alerting, and provider-specific quotas.

## Recovery and rollback

- Export local cases to JSON **before** clearing browser storage or migrating origins; JSON is an evidence export, not an automatic app import/restore function.
- Keep Git tags for every working submission milestone; on cloud platforms redeploy the previously working commit if a release breaks.
- Stop the Node server with Ctrl+C. Re-running `npm start` does not delete browser-local cases.
- If public RPC fails, do not edit case status to imply payment; keep the case inconclusive and retry after infrastructure recovers.

## Manual visual acceptance checklist

- [ ] Dashboard renders at 1440px desktop width
- [ ] Sidebar navigation and all call-to-action buttons work
- [ ] Mobile layout around 390px shows navigation toggle and form fields without clipping
- [ ] Sample case clearly says SIMULATION on every relevant screen
- [ ] Re-verify recovers from RPC errors with an explicit message
- [ ] CSV import and template download complete
- [ ] Printed report hides buttons and navigation
- [ ] Exported JSON includes caveats about external claims and settlement
- [ ] Demo can be followed without reading docs

No public URL can be given until hosting credentials are provided and the service is actually deployed.
