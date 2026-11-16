import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyTransaction } from './rpc.js';
import { getJupiterQuote, validateQuoteInput } from './jupiter.js';
import { fetchNetworkInfo, fetchProgramActivity, fetchWalletOverview, getNetworkInfo, getProgramActivity, getWalletOverview } from './analytics.js';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const assets = resolve(root, 'public');
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.json':'application/json' };
const attempts = new Map();
const analyticsAttempts = new Map();
const RATE_WINDOW = 60_000;
const JUPITER_COOLDOWN = 2_000;
let lastJupiterRequestAt = 0;

function response(res, status, body, extra = {}) {
  const base = {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'x-frame-options': 'DENY',
    'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    'cache-control': 'no-store',
    ...extra,
  };
  res.writeHead(status, base); res.end(body);
}
function json(res, status, data) { response(res, status, JSON.stringify(data), { 'content-type':'application/json; charset=utf-8' }); }
async function parseBody(req) {
  let data = '';
  for await (const chunk of req) {
    data += chunk.toString();
    if (data.length > 4096) throw Object.assign(new Error('Request body exceeds 4 KB'), { status: 413 });
  }
  try { return JSON.parse(data); }
  catch { throw Object.assign(new Error('Invalid JSON'), { status:400 }); }
}

export function createAppServer({ quoteJupiter = getJupiterQuote, verify = verifyTransaction, walletOverview = getWalletOverview, programActivity = getProgramActivity, networkInfo = getNetworkInfo, jupiterCooldownMs = JUPITER_COOLDOWN } = {}) {
  return createServer(async (req, res) => {
    try {
      const path = new URL(req.url || '/', 'http://localhost').pathname;
      if (path === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true, product: 'ChainCase', persistence: 'browser-local', solana: 'read-only' });
      if (path === '/api/defi/quote' && req.method === 'POST') {
        const input = validateQuoteInput(await parseBody(req));
        const now = Date.now();
        if (now - lastJupiterRequestAt < jupiterCooldownMs) return json(res, 429, { error: 'Jupiter quote limit reached; retry in two seconds' });
        lastJupiterRequestAt = now;
        const evidence = await verify({ signature: input.signature, network: input.network });
        if (evidence.source !== 'LIVE_RPC' || evidence.state !== 'FINALIZED_SUCCESS') return json(res, 409, { error: 'A successful finalized live mainnet transaction is required for a quote' });
        const matching = (evidence.transfers || []).filter(t => t.mint === input.mint && t.destination === input.destination && /^\d+$/.test(String(t.rawAmount)));
        const verifiedAmount = matching.reduce((sum, t) => sum + BigInt(t.rawAmount), 0n).toString();
        if (!matching.length || verifiedAmount !== input.amount) return json(res, 409, { error: 'Requested mint, destination and amount do not match the live transaction' });
        const quote = await quoteJupiter(input);
        return json(res, 200, quote);
      }
      if (path === '/api/verify' && req.method === 'POST') {
        const ip = req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        if (attempts.size > 5000) attempts.clear();
        const entry = attempts.get(ip);
        const count = !entry || now - entry.since > RATE_WINDOW ? 0 : entry.count;
        if (count >= 24) return json(res, 429, { error: 'Too many verification requests; retry after one minute' });
        attempts.set(ip, { since: count === 0 ? now : entry.since, count: count + 1 });
        const input = await parseBody(req);
        const evidence = await verifyTransaction(input);
        return json(res, 200, evidence);
      }
      if ((path === '/api/analytics/network' || path === '/api/blockchain/network' || path === '/api/network') && req.method === 'POST') {
        const input = await parseBody(req);
        const ip = req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        const entry = analyticsAttempts.get(ip);
        const count = !entry || now - entry.since > RATE_WINDOW ? 0 : entry.count;
        if (count >= 12) return json(res, 429, { error: 'Too many analytics requests; retry after one minute' });
        analyticsAttempts.set(ip, { since: count === 0 ? now : entry.since, count: count + 1 });
        const network = input?.network || 'mainnet-beta';
        const result = await networkInfo(network);
        return json(res, 200, result);
      }
      if ((path === '/api/analytics/wallet' || path === '/api/blockchain/wallet' || path === '/api/wallet') && req.method === 'POST') {
        const input = await parseBody(req);
        const ip = req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        const entry = analyticsAttempts.get(ip);
        const count = !entry || now - entry.since > RATE_WINDOW ? 0 : entry.count;
        if (count >= 12) return json(res, 429, { error: 'Too many analytics requests; retry after one minute' });
        analyticsAttempts.set(ip, { since: count === 0 ? now : entry.since, count: count + 1 });
        const result = await walletOverview(input?.address, input?.network || 'mainnet-beta', { before: input?.before, limit: input?.limit });
        return json(res, 200, result);
      }
      if ((path === '/api/analytics/program' || path === '/api/blockchain/program' || path === '/api/program') && req.method === 'POST') {
        const input = await parseBody(req);
        const ip = req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        const entry = analyticsAttempts.get(ip);
        const count = !entry || now - entry.since > RATE_WINDOW ? 0 : entry.count;
        if (count >= 12) return json(res, 429, { error: 'Too many analytics requests; retry after one minute' });
        analyticsAttempts.set(ip, { since: count === 0 ? now : entry.since, count: count + 1 });
        const result = await programActivity(input?.programId || input?.address, input?.network || 'mainnet-beta', { before: input?.before, limit: input?.limit });
        return json(res, 200, result);
      }
      if (path.startsWith('/api/')) return json(res, 404, { error: 'API endpoint not found' });
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed' });
      const resolved = path === '/' ? resolve(assets, 'index.html') : resolve(assets, '.' + decodeURIComponent(path));
      if (!resolved.startsWith(assets + sep) && resolved !== assets) return json(res, 403, { error: 'Access denied' });
      if (extname(resolved) && !types[extname(resolved)]) return json(res, 404, { error: 'Asset not found' });
      let filepath = resolved;
      try { if (!(await stat(filepath)).isFile()) filepath = resolve(assets, 'index.html'); }
      catch { if (!extname(filepath)) filepath = resolve(assets, 'index.html'); else return json(res, 404, { error: 'Asset not found' }); }
      const body = await readFile(filepath);
      return response(res, 200, req.method === 'HEAD' ? '' : body, { 'content-type': types[extname(filepath)] || types['.html'] });
    } catch (e) {
      return json(res, e?.status || 500, { error: e?.status ? e.message : 'Unexpected server error' });
    }
  });
}

const launchedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (launchedDirectly) {
  const port = Number(process.env.PORT || 3000);
  createAppServer().listen(port, '0.0.0.0', () => console.log(`ChainCase ready at http://localhost:${port}`));
}
