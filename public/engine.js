/**
 * ChainCase deterministic incident analyzer, shared by browser and tests.
 * The result describes the available evidence, not legal ownership or merchant settlement.
 */
const stat = (code, label, tone) => ({ code, label, tone });
const ALLOWED_STATUS = new Set(['PAID', 'FAILED', 'PENDING', 'UNKNOWN']);

export function normalizeStatus(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return ALLOWED_STATUS.has(normalized) ? normalized : 'UNKNOWN';
}

export function amountToRaw(input, decimals) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) throw new Error('Unsupported token decimal precision');
  const value = String(input ?? '').trim();
  if (!/^(0|[1-9]\d{0,17})(\.\d+)?$/.test(value)) throw new Error('Enter a valid positive decimal amount');
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > decimals) {
    if (/[^0]/.test(fraction.slice(decimals))) throw new Error('Amount exceeds token precision');
  }
  const raw = BigInt(whole) * 10n ** BigInt(decimals) + BigInt((fraction.slice(0, decimals).padEnd(decimals, '0') || '0'));
  if (raw <= 0n) throw new Error('Expected amount must exceed zero');
  return raw;
}

export function formatRaw(raw, decimals) {
  const v = BigInt(raw);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const base = 10n ** BigInt(decimals);
  const whole = String(abs / base);
  const rem = String(abs % base).padStart(decimals, '0').replace(/0+$/, '');
  return `${neg ? '-' : ''}${whole}${rem ? '.' + rem : ''}`;
}

/** Report outcomes are intentionally conservative and reference only available observations. */
export function analyzeCase(record, evidence, otherCases = []) {
  const findings = [];
  const add = (severity, title, detail) => findings.push({ severity, title, detail });
  const merchant = normalizeStatus(record.merchantStatus);
  const provider = normalizeStatus(record.providerStatus);
  const result = {
    status: stat('INCONCLUSIVE', 'Insufficient evidence', 'neutral'),
    findings,
    verifiedTransfer: null,
    dataOrigin: evidence?.source === 'LIVE_RPC' ? 'LIVE_RPC' : evidence?.source === 'DEMO_SIMULATION' ? 'DEMO_SIMULATION' : 'NONE',
    analyzedAt: new Date().toISOString(),
  };
  const dup = otherCases.some((c) => c.id !== record.id && c.signature && c.signature === record.signature && c.network === record.network);
  if (dup) add('warning', 'Signature also used in another case', 'The same transaction signature is linked to multiple locally saved cases. Investigate before crediting both orders.');
  if (!evidence) {
    add('info', 'Verification not yet performed', 'Submit a transaction signature to obtain independent onchain evidence.');
    return result;
  }
  if (evidence.state === 'RPC_UNAVAILABLE') {
    result.status = stat('INCONCLUSIVE', 'Verification unavailable', 'neutral');
    add('warning', 'RPC is temporarily unavailable', 'The verifier could not obtain trustworthy blockchain data. Do not infer that a payment failed.');
    return result;
  }
  if (evidence.state === 'NOT_FOUND') {
    add('warning', 'Transaction could not be established', 'The transaction was not returned as finalized. It may be pending, unavailable on this RPC, or on another network.');
    return result;
  }
  if (evidence.state === 'AWAITING_FINALITY') {
    result.status = stat('AWAITING_FINALITY', 'Awaiting finality', 'warning');
    add('info', 'Final confirmation not established', 'Transaction is known but has not yet met the finalized requirement. Try verification again.');
    return result;
  }
  if (evidence.state === 'FINALIZED_FAILED') {
    result.status = stat('ONCHAIN_FAILED', 'Onchain transaction failed', 'danger');
    add('critical', 'Finalized transaction did not succeed', 'RPC reports a transaction execution error. This signature is not evidence of a successful payment.');
    if (provider === 'PAID' || merchant === 'PAID') add('warning', 'Offchain paid status conflicts', 'A supplied offchain status claims payment, but this transaction failed. Investigate other possible payments.');
    return result;
  }
  if (evidence.state !== 'FINALIZED_SUCCESS') {
    add('warning', 'Unknown verifier state', 'Cannot safely interpret the blockchain response.');
    return result;
  }

  if (!record.destination || !record.mint || !record.expectedAmount) {
    add('critical', 'Expected payment details missing', 'Destination token account, token mint and exact expected amount are required.');
    return result;
  }
  const all = Array.isArray(evidence.transfers) ? evidence.transfers : [];
  const matching = all.filter((t) => t.destination === record.destination && t.mint === record.mint && /^\d+$/.test(String(t.rawAmount)) && Number.isInteger(t.decimals));
  if (!matching.length) {
    const wrongMint = all.some((t) => t.destination === record.destination && t.mint !== record.mint);
    result.status = stat('MISMATCH', wrongMint ? 'Token mismatch' : 'No matching transfer', 'danger');
    add('critical', wrongMint ? 'Unexpected token mint' : 'Expected transfer not established', wrongMint
      ? 'A token transfer to the expected token account appears in this transaction, but its mint does not match the specified mint.'
      : 'No parsed token transfer in this transaction matches both the expected token account and mint. This does not prove where funds went.');
    if (evidence.warnings?.length) add('info', 'Verification limitations', evidence.warnings.join(' '));
    return result;
  }

  const decimals = matching[0].decimals;
  if (matching.some((t) => t.decimals !== decimals)) {
    add('critical', 'Conflicting token precision', 'RPC data contains inconsistent decimals for the same mint. Manual review is required.');
    return result;
  }
  let target;
  try { target = amountToRaw(record.expectedAmount, decimals); }
  catch (e) {
    add('critical', 'Invalid expected amount', e.message);
    return result;
  }
  const actual = matching.reduce((sum, t) => sum + BigInt(t.rawAmount), 0n);
  result.verifiedTransfer = {
    actualAmount: formatRaw(actual, decimals),
    expectedAmount: formatRaw(target, decimals),
    decimals,
    destination: record.destination,
    mint: record.mint,
    transferCount: matching.length,
  };
  if (actual !== target) {
    const under = actual < target;
    result.status = stat('MISMATCH', under ? 'Amount below expected' : 'Amount above expected', 'danger');
    add('critical', under ? 'Amount below expected' : 'Amount above expected', `Expected ${formatRaw(target, decimals)} tokens; detected ${formatRaw(actual, decimals)} tokens transferred to the specified token account in the selected transaction.`);
    return result;
  }
  add('success', 'Onchain token transfer verified', `A finalized successful transaction contains ${matching.length} matching token transfer(s) totaling ${formatRaw(actual, decimals)} token units to the specified token account.`);
  if (evidence.warnings?.length) add('info', 'Verification limitations', evidence.warnings.join(' '));
  if (merchant === 'FAILED' || provider === 'FAILED') {
    result.status = stat('NEEDS_PROVIDER_REVIEW', 'Offchain status conflict', 'warning');
    add('warning', 'Records disagree with onchain transfer', 'An imported status reports failure while the specified transfer is present onchain. This does not establish merchant settlement; obtain the provider ledger and order-to-payment mapping.');
  } else if (merchant === 'PAID' && provider === 'PAID') {
    result.status = stat('RECORDS_ALIGNED', 'Records aligned', 'success');
    add('info', 'Imported statuses align', 'Both imported records report PAID. These records are third-party claims unless independently authenticated.');
  } else if (merchant === 'PENDING' || provider === 'PENDING') {
    result.status = stat('NEEDS_PROVIDER_REVIEW', 'Awaiting offchain reconciliation', 'warning');
    add('warning', 'Offchain status remains pending', 'Onchain transfer is verified but at least one imported system has not reconciled the payment.');
  } else {
    result.status = stat('ONCHAIN_VERIFIED', 'Transfer verified; settlement unknown', 'neutral');
    add('info', 'Merchant settlement not established', 'Onchain verification cannot by itself confirm payment-provider credit or delivery of an order.');
  }
  return result;
}

export function buildExport(record, result) {
  return {
    document: 'ChainCase payment investigation',
    version: '1.0',
    generatedAt: new Date().toISOString(),
    caution: 'Not a settlement certificate. User-provided offchain records have not been independently authenticated.',
    order: { orderId: record.orderId, merchantName: record.merchantName, expectedAmount: record.expectedAmount, destination: record.destination, mint: record.mint, network: record.network, signature: record.signature },
    claims: { merchantStatus: normalizeStatus(record.merchantStatus), providerStatus: normalizeStatus(record.providerStatus), source: record.recordSource || 'MANUALLY_ENTERED' },
    onchainEvidence: record.evidence || null,
    analysis: result,
  };
}
