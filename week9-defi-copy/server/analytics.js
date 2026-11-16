import { isSolanaAddress } from './rpc.js';

const RPC = {
  devnet: process.env.SOLANA_DEVNET_RPC || 'https://api.devnet.solana.com',
  'mainnet-beta': process.env.SOLANA_MAINNET_RPC || 'https://api.mainnet-beta.solana.com',
};

const rpcNextStart = new Map();
const RPC_MIN_INTERVAL_MS = 150;
async function paceRpc(endpoint) {
  const now = Date.now();
  const startAt = Math.max(now, rpcNextStart.get(endpoint) || 0);
  rpcNextStart.set(endpoint, startAt + RPC_MIN_INTERVAL_MS);
  if (startAt > now) await new Promise((resolve) => setTimeout(resolve, startAt - now));
}

export function getRpcEndpoint(network = 'mainnet-beta') {
  const key = String(network || 'mainnet-beta');
  if (!Object.hasOwn(RPC, key)) throw Object.assign(new Error('Unsupported Solana network'), { status: 400 });
  return RPC[key];
}

export function lamportsToSol(value) {
  if (!/^\d+$/.test(String(value))) throw new TypeError('Lamports must be a non-negative integer');
  const raw = BigInt(value);
  const whole = raw / 1_000_000_000n;
  const fraction = String(raw % 1_000_000_000n).padStart(9, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : String(whole);
}

export function explorerAddress(address, network = 'mainnet-beta') {
  const cluster = network === 'devnet' ? '?cluster=devnet' : '';
  return `https://explorer.solana.com/address/${encodeURIComponent(address)}${cluster}`;
}

export function explorerLink(signature, network = 'mainnet-beta') {
  const cluster = network === 'devnet' ? '?cluster=devnet' : '';
  return `https://explorer.solana.com/tx/${encodeURIComponent(signature)}${cluster}`;
}

async function rpcRequest(endpoint, method, params = [], fetcher = globalThis.fetch, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await paceRpc(endpoint);
    let response = await fetcher(endpoint, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: controller.signal,
    });
    if (response.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await paceRpc(endpoint);
      response = await fetcher(endpoint, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: controller.signal,
      });
    }
    if (!response.ok) throw Object.assign(new Error(response.status === 429 ? 'Solana RPC rate limit reached; retry shortly' : `Solana RPC returned HTTP ${response.status}`), { status: 503 });
    let rawBody = null;
    const body = typeof response.text === 'function' ? (rawBody = await response.text(), JSON.parse(rawBody)) : await response.json();
    if (body?.error) throw Object.assign(new Error('Solana RPC rejected the request or data is unavailable'), { status: 503 });
    if (method === 'getBalance' && rawBody) {
      const exactLamports = rawBody.match(/"value"\s*:\s*(\d+)/)?.[1];
      if (exactLamports) body.result.value = exactLamports;
    }
    return body.result;
  } catch (error) {
    if (error.status) throw error;
    throw Object.assign(new Error(error.name === 'AbortError' ? 'Solana RPC timed out; retry shortly' : 'Solana RPC unavailable'), { status: 503 });
  } finally { clearTimeout(timer); }
}

async function fetchTransaction(endpoint, signature, fetcher) {
  const base = { encoding: 'jsonParsed', maxSupportedTransactionVersion: 1 };
  const transaction = await rpcRequest(endpoint, 'getTransaction', [signature, { ...base, commitment: 'finalized' }], fetcher);
  if (transaction) return transaction;
  return rpcRequest(endpoint, 'getTransaction', [signature, { ...base, commitment: 'confirmed' }], fetcher);
}

function transactionStatus(transaction, signatureRow) {
  if (transaction?.meta && Object.hasOwn(transaction.meta, 'err')) return transaction.meta.err === null ? 'success' : 'failed';
  if (signatureRow && Object.hasOwn(signatureRow, 'err')) return signatureRow.err === null ? 'success' : 'failed';
  return 'unknown';
}

export function inferTransactionType(transaction) {
  const top = transaction?.transaction?.message?.instructions || [];
  const inner = (transaction?.meta?.innerInstructions || []).flatMap((group) => group.instructions || []);
  const tokenPrograms = new Set(['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']);
  const systemProgram = '11111111111111111111111111111111';
  const kinds = new Set();
  for (const instruction of [...top, ...inner]) {
    const type = instruction?.parsed?.type;
    const program = instruction?.program;
    const programId = instruction?.programId;
    const isToken = program === 'spl-token' || program === 'spl-token-2022' || tokenPrograms.has(programId);
    const isSystem = program === 'system' || programId === systemProgram;
    if (isToken && ['transfer', 'transferChecked'].includes(type)) kinds.add('token_transfer');
    else if (isToken && type) kinds.add('token_instruction');
    if (isSystem && type === 'transfer') kinds.add('sol_transfer');
    else if (isSystem && type) kinds.add('system_instruction');
  }
  if (kinds.size === 1) return [...kinds][0];
  if (kinds.size > 1) return 'mixed_activity';
  return 'unknown';
}
export async function getNetworkInfo(network = 'mainnet-beta', opts = {}) {
  const endpoint = opts.rpcUrl || getRpcEndpoint(network);
  const fetcher = opts.fetcher || globalThis.fetch;
  const now = new Date().toISOString();
  try {
    const slot = await rpcRequest(endpoint, 'getSlot', [], fetcher);
    return {
      network,
      activeNetwork: network,
      rpcConnectionStatus: 'connected',
      latestObservedSlot: slot ?? null,
      lastSuccessfulRefresh: now,
      providerError: null,
      explorerBase: network === 'devnet' ? 'https://explorer.solana.com/?cluster=devnet' : 'https://explorer.solana.com/',
    };
  } catch (error) {
    return {
      network,
      activeNetwork: network,
      rpcConnectionStatus: 'error',
      latestObservedSlot: null,
      lastSuccessfulRefresh: null,
      providerError: error?.message || 'Unable to reach the Solana RPC endpoint',
      explorerBase: network === 'devnet' ? 'https://explorer.solana.com/?cluster=devnet' : 'https://explorer.solana.com/',
    };
  }
}

function exactTokenAmount(raw, decimals) {
  if (!/^\d+$/.test(String(raw)) || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) return 'unavailable';
  const digits = String(raw).padStart(decimals + 1, '0');
  if (!decimals) return digits;
  const fraction = digits.slice(-decimals).replace(/0+$/, '');
  return fraction ? `${digits.slice(0, -decimals)}.${fraction}` : digits.slice(0, -decimals);
}

async function mapLimited(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  }));
  return results;
}

async function getWalletOverviewLegacy(address, network = 'mainnet-beta', opts = {}) {
  if (!isSolanaAddress(address, 32)) {
    throw Object.assign(new Error('Wallet address must be a valid 32-byte base58 Solana address'), { status: 400 });
  }
  const endpoint = opts.rpcUrl || getRpcEndpoint(network);
  const fetcher = opts.fetcher || globalThis.fetch;

  const [balance, tokenAccounts, signatures] = await Promise.all([
    rpcRequest(endpoint, 'getBalance', [address], fetcher),
    rpcRequest(endpoint, 'getTokenAccountsByOwner', [address, { programId: 'TokenkegQfeZyiNwAJbNbGzOKC' }, { encoding: 'jsonParsed' }], fetcher).catch(() => ({ value: [] })),
    rpcRequest(endpoint, 'getSignaturesForAddress', [address, { limit: 12 }], fetcher).catch(() => ({ signatures: [] })),
  ]);

  const walletBalance = Number(balance?.value ?? 0) / 1_000_000_000;
  const tokenEntries = (tokenAccounts?.value || []).map((entry) => {
    const parsed = entry?.account?.data?.parsed?.info || {};
    const mint = parsed.mint || null;
    const decimals = Number(parsed.tokenAmount?.decimals ?? 0);
    const raw = String(parsed.tokenAmount?.amount ?? '0');
    const uiAmount = typeof parsed.tokenAmount?.uiAmountString === 'string' ? parsed.tokenAmount.uiAmountString : '0';
    return {
      mint,
      symbol: mint ? 'UNKNOWN' : '—',
      balance: uiAmount,
      rawAmount: raw,
      decimals,
      tokenAccountAddress: entry?.pubkey || null,
      tokenProgram: entry?.account?.owner || 'TokenkegQfeZyiNwAJbNbGzOKC',
      explorerUrl: mint ? explorerAddress(mint, network) : null,
    };
  });

  const recentSignatures = (signatures?.signatures || signatures?.value || []).slice(0, 12);
  const txs = await Promise.all(recentSignatures.map(async (row) => {
    const signature = typeof row?.signature === 'string' ? row.signature : row?.txHash;
    if (!signature) return null;
    try {
      const tx = await fetchTransaction(endpoint, signature, fetcher);
      return {
        signature,
        dateTime: row?.blockTime ? new Date(Number(row.blockTime) * 1000).toISOString() : null,
        status: transactionStatus(tx, row),
        fee: Number.isSafeInteger(tx?.meta?.fee) ? String(tx.meta.fee) : 'unknown',
        slot: tx?.slot ?? row?.slot ?? null,
        transactionType: inferTransactionType(tx),
        explorerUrl: explorerLink(signature, network),
      };
    } catch {
      return {
        signature,
        dateTime: row?.blockTime ? new Date(Number(row.blockTime) * 1000).toISOString() : null,
        status: 'unknown',
        fee: 'unknown',
        slot: row?.slot ?? null,
        transactionType: 'unknown',
        explorerUrl: explorerLink(signature, network),
      };
    }
  }));

  return {
    address,
    network,
    walletAddress: address,
    solBalance: walletBalance,
    lamports: Number(balance?.value ?? 0),
    tokenAccountCount: tokenEntries.length,
    recentTransactionCount: txs.filter(Boolean).length,
    lastSuccessfulRefresh: new Date().toISOString(),
    explorerUrl: explorerAddress(address, network),
    tokenAccounts: tokenEntries,
    recentTransactions: txs.filter(Boolean),
    networkInfo: await getNetworkInfo(network, { rpcUrl: endpoint, fetcher }),
  };
}

export async function getWalletOverview(address, network = 'mainnet-beta', opts = {}) {
  if (!isSolanaAddress(address, 32)) throw Object.assign(new Error('Wallet address must be a valid 32-byte base58 Solana address'), { status: 400 });
  const endpoint = opts.rpcUrl || getRpcEndpoint(network);
  const fetcher = opts.fetcher || globalThis.fetch;
  const limit = Math.max(1, Math.min(Number(opts.limit) || 12, 20));
  if (opts.before !== undefined && !isSolanaAddress(opts.before, 64)) throw Object.assign(new Error('Invalid transaction pagination cursor'), { status: 400 });
  const tokenPrograms = ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'];
  const [balance, tokenResults, signatures] = await Promise.all([
    rpcRequest(endpoint, 'getBalance', [address], fetcher),
    Promise.all(tokenPrograms.map((programId) => rpcRequest(endpoint, 'getTokenAccountsByOwner', [address, { programId }, { encoding: 'jsonParsed' }], fetcher))),
    rpcRequest(endpoint, 'getSignaturesForAddress', [address, { limit, ...(opts.before ? { before: opts.before } : {}) }], fetcher),
  ]);
  const tokenEntries = tokenResults.flatMap((result) => result?.value || []).map((entry) => {
    const parsed = entry?.account?.data?.parsed?.info || {};
    const mint = parsed.mint || null;
    const decimals = Number(parsed.tokenAmount?.decimals ?? 0);
    const rawAmount = String(parsed.tokenAmount?.amount ?? '0');
    return {
      mint,
      symbol: mint ? `${mint.slice(0, 4)}...${mint.slice(-4)}` : 'unknown',
      balance: exactTokenAmount(rawAmount, decimals), rawAmount, decimals,
      tokenAccountAddress: entry?.pubkey || null,
      tokenProgram: entry?.account?.owner || 'unknown',
      explorerUrl: mint ? explorerAddress(mint, network) : null,
    };
  });
  const rows = Array.isArray(signatures) ? signatures : [];
  const transactions = await mapLimited(rows, 4, async (row) => {
    const signature = row?.signature;
    if (typeof signature !== 'string') return null;
    try {
      const tx = await fetchTransaction(endpoint, signature, fetcher);
      return { signature, dateTime: Number.isFinite(row.blockTime) ? new Date(row.blockTime * 1000).toISOString() : null,
        status: transactionStatus(tx, row),
        fee: Number.isSafeInteger(tx?.meta?.fee) ? String(tx.meta.fee) : 'unknown', slot: tx?.slot ?? row.slot ?? null,
        transactionType: inferTransactionType(tx), explorerUrl: explorerLink(signature, network) };
    } catch {
      return { signature, dateTime: Number.isFinite(row.blockTime) ? new Date(row.blockTime * 1000).toISOString() : null,
        status: transactionStatus(null, row), fee: 'unknown', slot: row.slot ?? null, transactionType: 'unknown', explorerUrl: explorerLink(signature, network) };
    }
  });
  const refreshTime = new Date().toISOString();
  return { address, walletAddress: address, network, solBalance: lamportsToSol(balance?.value ?? 0), lamports: String(balance?.value ?? 0),
    tokenAccountCount: tokenEntries.length, recentTransactionCount: transactions.filter(Boolean).length,
    transactionCursor: rows.at(-1)?.signature || null, hasMoreTransactions: rows.length === limit,
    lastSuccessfulRefresh: refreshTime, explorerUrl: explorerAddress(address, network), tokenAccounts: tokenEntries,
    recentTransactions: transactions.filter(Boolean), networkInfo: await getNetworkInfo(network, { rpcUrl: endpoint, fetcher }) };
}

async function getProgramActivityLegacy(programId, network = 'mainnet-beta', opts = {}) {
  if (!isSolanaAddress(programId, 32)) {
    throw Object.assign(new Error('Program ID must be a valid 32-byte base58 Solana address'), { status: 400 });
  }
  const endpoint = opts.rpcUrl || getRpcEndpoint(network);
  const fetcher = opts.fetcher || globalThis.fetch;
  const signatures = await rpcRequest(endpoint, 'getSignaturesForAddress', [programId, { limit: 12 }], fetcher).catch(() => ({ signatures: [] }));
  const recent = (signatures?.signatures || signatures?.value || []).slice(0, 12);
  const items = await Promise.all(recent.map(async (row) => {
    const signature = typeof row?.signature === 'string' ? row.signature : row?.txHash;
    if (!signature) return null;
    try {
      const tx = await fetchTransaction(endpoint, signature, fetcher);
      const instructions = tx?.transaction?.message?.instructions || [];
      const decoded = instructions.map((instruction) => ({ programId: instruction?.programId || instruction?.program || 'unknown', type: instruction?.parsed?.type || 'instruction' }));
      return {
        programId,
        signature,
        status: transactionStatus(tx, row),
        slot: tx?.slot ?? row?.slot ?? null,
        timestamp: row?.blockTime ? new Date(Number(row.blockTime) * 1000).toISOString() : null,
        explorerUrl: explorerLink(signature, network),
        decodedInstructions: decoded.slice(0, 8),
      };
    } catch {
      return {
        programId,
        signature,
        status: 'unknown',
        slot: row?.slot ?? null,
        timestamp: row?.blockTime ? new Date(Number(row.blockTime) * 1000).toISOString() : null,
        explorerUrl: explorerLink(signature, network),
        decodedInstructions: [],
      };
    }
  }));

  return {
    programId,
    network,
    explorerUrl: explorerAddress(programId, network),
    recentSignatures: items.filter(Boolean),
    note: 'Program activity through standard RPC is limited to a recent, queryable slice of signatures and decoded instruction metadata. Total historical coverage requires an indexing service or account-specific logs.',
  };
}

export async function getProgramActivity(programId, network = 'mainnet-beta', opts = {}) {
  if (!isSolanaAddress(programId, 32)) throw Object.assign(new Error('Program ID must be a valid 32-byte base58 Solana address'), { status: 400 });
  if (opts.before !== undefined && !isSolanaAddress(opts.before, 64)) throw Object.assign(new Error('Invalid program activity pagination cursor'), { status: 400 });
  const endpoint = opts.rpcUrl || getRpcEndpoint(network);
  const fetcher = opts.fetcher || globalThis.fetch;
  const limit = Math.max(1, Math.min(Number(opts.limit) || 12, 20));
  const signatures = await rpcRequest(endpoint, 'getSignaturesForAddress', [programId, { limit, ...(opts.before ? { before: opts.before } : {}) }], fetcher);
  const rows = Array.isArray(signatures) ? signatures : [];
  const items = await mapLimited(rows, 4, async (row) => {
    const signature = row?.signature;
    if (typeof signature !== 'string') return null;
    try {
      const tx = await fetchTransaction(endpoint, signature, fetcher);
      const message = tx?.transaction?.message;
      const instructions = [...(message?.instructions || []), ...((tx?.meta?.innerInstructions || []).flatMap((group) => group.instructions || []))];
      const decoded = instructions.filter((instruction) => instruction.programId === programId || instruction.program === programId)
        .map((instruction) => ({ programId, type: instruction?.parsed?.type || instruction?.program || 'instruction', parsed: instruction?.parsed?.info || null }));
      return { programId, signature, status: transactionStatus(tx, row), fee: Number.isSafeInteger(tx?.meta?.fee) ? String(tx.meta.fee) : 'unknown', transactionType: inferTransactionType(tx),
        slot: tx?.slot ?? row.slot ?? null, timestamp: Number.isFinite(row.blockTime) ? new Date(row.blockTime * 1000).toISOString() : null,
        explorerUrl: explorerLink(signature, network), decodedInstructions: decoded.slice(0, 8) };
    } catch {
      return { programId, signature, status: transactionStatus(null, row), fee: 'unknown', transactionType: 'unknown', slot: row.slot ?? null,
        timestamp: Number.isFinite(row.blockTime) ? new Date(row.blockTime * 1000).toISOString() : null,
        explorerUrl: explorerLink(signature, network), decodedInstructions: [] };
    }
  });
  return { programId, network, explorerUrl: explorerAddress(programId, network), recentSignatures: items.filter(Boolean),
    transactionCursor: rows.at(-1)?.signature || null, hasMore: rows.length === limit,
    note: 'Standard RPC returns a recent, provider-queryable slice of address signatures; it does not guarantee complete program history. Some instruction data remains undecoded. Use an optional indexing service for broader historical queries.' };
}

export const fetchWalletOverview = getWalletOverview;
export const fetchProgramActivity = getProgramActivity;
export const fetchNetworkInfo = getNetworkInfo;


