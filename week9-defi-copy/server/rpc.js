const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const RPC = {
  devnet: process.env.SOLANA_DEVNET_RPC || 'https://api.devnet.solana.com',
  'mainnet-beta': process.env.SOLANA_MAINNET_RPC || 'https://api.mainnet-beta.solana.com',
};

export function isSolanaAddress(value, length = 32) {
  if (typeof value !== 'string' || value.length < 32 || value.length > 90) return false;
  if ([...value].some((ch) => !BASE58.includes(ch))) return false;
  let n = 0n;
  for (const c of value) n = n * 58n + BigInt(BASE58.indexOf(c));
  let size = 0;
  while (n > 0n) { size++; n >>= 8n; }
  let zeroes = 0;
  for (const c of value) { if (c !== '1') break; zeroes++; }
  return size + zeroes === length;
}

export function validateVerificationInput(value) {
  if (!value || typeof value !== 'object') throw Object.assign(new Error('Provide a transaction signature and network'), { status: 400 });
  if (!['devnet', 'mainnet-beta'].includes(value.network)) throw Object.assign(new Error('Unsupported Solana network'), { status: 400 });
  if (!isSolanaAddress(value.signature, 64)) throw Object.assign(new Error('Signature must be a 64-byte base58-encoded Solana signature'), { status: 400 });
  return { signature: value.signature, network: value.network };
}

export function readTransfers(transaction) {
  const keys = transaction?.transaction?.message?.accountKeys || [];
  const keyToString = (entry) => typeof entry === 'string' ? entry : entry?.pubkey;
  const balances = [...(transaction?.meta?.preTokenBalances || []), ...(transaction?.meta?.postTokenBalances || [])];
  const mintData = new Map();
  for (const balance of balances) {
    const account = keyToString(keys[balance.accountIndex]);
    if (account && balance.mint && balance.uiTokenAmount?.decimals !== undefined) {
      const old = mintData.get(account);
      if (!old || old.mint === balance.mint) mintData.set(account, { mint: balance.mint, decimals: balance.uiTokenAmount.decimals });
    }
  }
  const instructions = [
    ...(transaction?.transaction?.message?.instructions || []),
    ...(transaction?.meta?.innerInstructions || []).flatMap((group) => group.instructions || []),
  ];
  const transfers = [];
  const warnings = [];
  for (const instruction of instructions) {
    const p = instruction?.parsed;
    // Exclude native SOL transfers and any other instruction parser.
    if (instruction?.program !== 'spl-token' || !p || !['transfer', 'transferChecked'].includes(p.type)) continue;
    const i = p.info || {};
    if (typeof i.destination !== 'string' || typeof i.source !== 'string') continue;
    const ctx = mintData.get(i.destination) || mintData.get(i.source);
    const mint = typeof i.mint === 'string' ? i.mint : ctx?.mint;
    const decimals = Number.isInteger(i.tokenAmount?.decimals) ? i.tokenAmount.decimals : ctx?.decimals;
    const rawAmount = typeof i.tokenAmount?.amount === 'string' ? i.tokenAmount.amount : String(i.amount ?? '');
    if (!mint || !Number.isInteger(decimals) || !/^\d+$/.test(rawAmount)) {
      warnings.push('A parsed token transfer lacked mint, precision, or raw amount; it was not counted.');
      continue;
    }
    if (decimals < 0 || decimals > 18) { warnings.push('Unsupported token precision encountered.'); continue; }
    transfers.push({ source: i.source, destination: i.destination, mint, decimals, rawAmount, parsedType: p.type });
  }
  return { transfers, warnings: [...new Set(warnings)] };
}

function rpcError(code, message) {
  return Object.assign(new Error(message), { status: code });
}

export async function verifyTransaction(input, opts = {}) {
  const { signature, network } = validateVerificationInput(input);
  const endpoint = opts.rpcUrl || RPC[network];
  const fetcher = opts.fetcher || globalThis.fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  const request = async (method, params) => {
    const response = await fetcher(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    });
    if (!response.ok) throw rpcError(503, `Solana RPC returned HTTP ${response.status}`);
    const body = await response.json();
    if (body.error) throw rpcError(503, 'Solana RPC rejected the request or the transaction version is unsupported');
    return body.result;
  };
  try {
    const tx = await request('getTransaction', [signature, { encoding: 'jsonParsed', commitment: 'finalized', maxSupportedTransactionVersion: 0 }]);
    let state = 'NOT_FOUND';
    let result = { state, source: 'LIVE_RPC', signature, network, slot: null, blockTime: null, transfers: [], warnings: [], explorerUrl: explorerLink(signature, network) };
    if (!tx) {
      const statuses = await request('getSignatureStatuses', [[signature], { searchTransactionHistory: true }]);
      const status = statuses?.value?.[0];
      if (status && status.confirmationStatus !== 'finalized') result.state = 'AWAITING_FINALITY';
      if (status && status.confirmationStatus === 'finalized') result.warnings.push('Signature status is finalized but parsed transaction is unavailable on this RPC.');
      return result;
    }
    result.state = tx.meta?.err ? 'FINALIZED_FAILED' : 'FINALIZED_SUCCESS';
    result.slot = tx.slot ?? null;
    result.blockTime = tx.blockTime ?? null;
    if (result.state === 'FINALIZED_SUCCESS') {
      const parsed = readTransfers(tx);
      result.transfers = parsed.transfers;
      result.warnings = parsed.warnings;
    }
    return result;
  } catch (e) {
    if (e.status && e.status < 500) throw e;
    throw rpcError(503, e.name === 'AbortError' ? 'Solana RPC timed out; retry verification' : 'Solana RPC unavailable; no payment conclusion can be drawn');
  } finally { clearTimeout(timeout); }
}

export function explorerLink(signature, network) {
  const cluster = network === 'devnet' ? '?cluster=devnet' : '';
  return `https://explorer.solana.com/tx/${encodeURIComponent(signature)}${cluster}`;
}
