import test from 'node:test';
import assert from 'node:assert/strict';
import { getNetworkInfo, getProgramActivity, getWalletOverview, lamportsToSol } from '../server/analytics.js';

const owner = '1'.repeat(32);
const signature = '2'.repeat(64);
const mint = '3'.repeat(32);
const account = '4'.repeat(32);
const token2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

test('SOL balance conversion is exact and accepts integer lamports only', () => {
  assert.equal(lamportsToSol('1230000005'), '1.230000005');
  assert.equal(lamportsToSol('0'), '0');
  assert.throws(() => lamportsToSol('1.5'), /integer/);
});

test('wallet validation rejects invalid addresses and empty wallets return an empty portfolio', async () => {
  await assert.rejects(() => getWalletOverview('not-a-public-key', 'devnet', { fetcher: async () => { throw Error('must not fetch'); } }), { status: 400 });
  const fetcher = async (_url, options) => {
    const method = JSON.parse(options.body).method;
    const result = method === 'getBalance' ? { value: 0 } : method === 'getTokenAccountsByOwner' ? { value: [] } : method === 'getSignaturesForAddress' ? [] : 1;
    return { ok: true, json: async () => ({ result }) };
  };
  const data = await getWalletOverview(owner, 'devnet', { fetcher });
  assert.equal(data.tokenAccountCount, 0);
  assert.equal(data.recentTransactionCount, 0);
  assert.deepEqual(data.tokenAccounts, []);
});

test('wallet overview reads both token programs and exact token amounts', async () => {
  const requests = [];
  const fetcher = async (_url, options) => {
    const request = JSON.parse(options.body); requests.push(request);
    let result;
    if (request.method === 'getBalance') result = { value: 1230000005 };
    else if (request.method === 'getTokenAccountsByOwner') {
      const is2022 = request.params[1].programId === token2022;
      result = { value: is2022 ? [{ pubkey: account, account: { owner: token2022, data: { parsed: { info: { mint, tokenAmount: { amount: '100000001', decimals: 6 } } } } } }] : [] };
    } else if (request.method === 'getSignaturesForAddress') result = [];
    else if (request.method === 'getSlot') result = 99;
    return { ok: true, json: async () => ({ result }) };
  };
  const data = await getWalletOverview(owner, 'devnet', { fetcher });
  assert.equal(data.solBalance, '1.230000005');
  assert.equal(data.lamports, '1230000005');
  assert.equal(data.tokenAccountCount, 1);
  assert.equal(data.tokenAccounts[0].balance, '100.000001');
  assert.match(data.tokenAccounts[0].symbol, /^3{4}\.\.\.3{4}$/);
  assert.equal(data.tokenAccounts[0].tokenProgram, token2022);
  assert.equal(requests.filter((request) => request.method === 'getTokenAccountsByOwner').length, 2);
  assert.match(data.explorerUrl, /cluster=devnet/);
});

test('large RPC lamport integers survive JSON number precision limits', async () => {
  const fetcher = async (_url, options) => {
    const method = JSON.parse(options.body).method;
    if (method === 'getBalance') return { ok: true, text: async () => '{"result":{"value":9007199254740993}}' };
    const result = method === 'getTokenAccountsByOwner' ? { value: [] } : method === 'getSignaturesForAddress' ? [] : 1;
    return { ok: true, json: async () => ({ result }) };
  };
  const data = await getWalletOverview(owner, 'devnet', { fetcher });
  assert.equal(data.lamports, '9007199254740993');
  assert.equal(data.solBalance, '9007199.254740993');
});

test('wallet transaction history uses before cursor and reports next page', async () => {
  let signatureRequest;
  const fetcher = async (_url, options) => {
    const request = JSON.parse(options.body);
    let result;
    if (request.method === 'getBalance') result = { value: 0 };
    if (request.method === 'getTokenAccountsByOwner') result = { value: [] };
    if (request.method === 'getSignaturesForAddress') { signatureRequest = request; result = [{ signature, slot: 4, blockTime: 1760000000 }]; }
    if (request.method === 'getTransaction') result = { slot: 4, meta: { fee: 5000, err: null }, transaction: { message: { instructions: [] } } };
    if (request.method === 'getSlot') result = 4;
    return { ok: true, json: async () => ({ result }) };
  };
  const data = await getWalletOverview(owner, 'mainnet-beta', { fetcher, before: '1'.repeat(64), limit: 1 });
  assert.equal(signatureRequest.params[1].before, '1'.repeat(64));
  assert.equal(data.recentTransactions[0].fee, '5000');
  assert.equal(data.recentTransactions[0].transactionType, 'unknown');
  assert.equal(data.transactionCursor, signature);
  assert.equal(data.hasMoreTransactions, true);
});

test('network errors and invalid network selections are not converted to empty data', async () => {
  await assert.rejects(() => getWalletOverview(owner, 'invalid', { fetcher: async () => { throw Error('must not fetch'); } }), { status: 400 });
  await assert.rejects(() => getWalletOverview(owner, 'devnet', { fetcher: async () => ({ ok: false, status: 429 }) }), { status: 503 });
  const info = await getNetworkInfo('devnet', { fetcher: async () => ({ ok: false, status: 429 }) });
  assert.equal(info.rpcConnectionStatus, 'error');
  assert.match(info.providerError, /rate limit/i);
});

test('program activity retrieves signatures and decoded instructions through RPC', async () => {
  const calls = [];
  const fetcher = async (_url, options) => {
    const request = JSON.parse(options.body); calls.push(request);
    const result = request.method === 'getSignaturesForAddress'
      ? [{ signature, slot: 7, blockTime: 1760000000 }]
      : request.method === 'getTransaction'
        ? { slot: 7, meta: { err: null, fee: 12500, innerInstructions: [] }, transaction: { message: { instructions: [{ programId: owner, parsed: { type: 'initialize', info: { value: 1 } } }] } } }
        : null;
    return { ok: true, json: async () => ({ result }) };
  };
  const activity = await getProgramActivity(owner, 'devnet', { fetcher, limit: 1 });
  assert.equal(calls[0].method, 'getSignaturesForAddress');
  assert.equal(activity.recentSignatures[0].decodedInstructions[0].type, 'initialize');
  assert.equal(activity.recentSignatures[0].status, 'success');
  assert.equal(activity.recentSignatures[0].fee, '12500');
  assert.equal(activity.recentSignatures[0].transactionType, 'system_instruction');
  assert.equal(calls[1].params[1].maxSupportedTransactionVersion, 1);
  assert.equal(activity.hasMore, true);
  assert.match(activity.note, /does not guarantee complete/i);
});

test('version-one transaction details are fetched and transaction type is conservative', async () => {
  const calls = [];
  const fetcher = async (_url, options) => {
    const request = JSON.parse(options.body); calls.push(request);
    let result;
    if (request.method === 'getBalance') result = { value: 0 };
    else if (request.method === 'getTokenAccountsByOwner') result = { value: [] };
    else if (request.method === 'getSignaturesForAddress') result = [{ signature, slot: 9, blockTime: 1760000000, err: null, confirmationStatus: 'finalized' }];
    else if (request.method === 'getTransaction') {
      result = request.params[1].commitment === 'finalized' ? null : { version: 1, slot: 9, meta: { err: null, fee: 7500, innerInstructions: [] }, transaction: { message: { instructions: [{ program: 'spl-token-2022', programId: token2022, parsed: { type: 'transferChecked', info: {} } }] } } };
    } else if (request.method === 'getSlot') result = 9;
    return { ok: true, json: async () => ({ result }) };
  };
  const data = await getWalletOverview(owner, 'mainnet-beta', { fetcher });
  const tx = data.recentTransactions[0];
  assert.equal(tx.status, 'success');
  assert.equal(tx.fee, '7500');
  assert.equal(tx.transactionType, 'token_transfer');
  const detailCalls = calls.filter((call) => call.method === 'getTransaction');
  assert.deepEqual(detailCalls.map((call) => call.params[1].commitment), ['finalized', 'confirmed']);
  assert.ok(detailCalls.every((call) => call.params[1].maxSupportedTransactionVersion === 1));
});

test('unavailable transaction details retain known execution status but do not fabricate fee or type', async () => {
  const fetcher = async (_url, options) => {
    const request = JSON.parse(options.body);
    if (request.method === 'getBalance') return { ok: true, json: async () => ({ result: { value: 0 } }) };
    if (request.method === 'getTokenAccountsByOwner') return { ok: true, json: async () => ({ result: { value: [] } }) };
    if (request.method === 'getSignaturesForAddress') return { ok: true, json: async () => ({ result: [{ signature, slot: 10, err: null }] }) };
    if (request.method === 'getTransaction') return { ok: true, json: async () => ({ error: { code: -32015 } }) };
    return { ok: true, json: async () => ({ result: 10 }) };
  };
  const data = await getWalletOverview(owner, 'mainnet-beta', { fetcher });
  assert.equal(data.recentTransactions[0].status, 'success');
  assert.equal(data.recentTransactions[0].fee, 'unknown');
  assert.equal(data.recentTransactions[0].transactionType, 'unknown');
});

