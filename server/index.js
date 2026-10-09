import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyTransaction } from './rpc.js';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const assets = resolve(root, 'public');
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.json':'application/json' };
const attempts = new Map();
const RATE_WINDOW = 60_000;

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

export function createAppServer() {
  return createServer(async (req, res) => {
    try {
      const path = new URL(req.url || '/', 'http://localhost').pathname;
      if (path === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true, product: 'ChainCase', persistence: 'browser-local', solana: 'read-only' });
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
