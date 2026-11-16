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
    caseId: record.id,
    executiveSummary: investigationGuidance(record,result),
    audit: { createdAt:record.createdAt, updatedAt:record.updatedAt, verifiedAt:record.verifiedAt, claimImportedAt:record.claimImportedAt, claimFileName:record.claimFileName, latestVerificationError:record.lastVerificationError||null },
    document: 'ChainCase payment investigation',
    version: '1.0',
    generatedAt: new Date().toISOString(),
    caution: 'Not a settlement certificate. User-provided offchain records have not been independently authenticated.',
    order: { orderId: record.orderId, merchantName: record.merchantName, expectedAmount: record.expectedAmount, destination: record.destination, mint: record.mint, network: record.network, signature: record.signature },
    claims: { merchantStatus: normalizeStatus(record.merchantStatus), providerStatus: normalizeStatus(record.providerStatus), source: record.recordSource || 'MANUALLY_ENTERED', origins:record.claimOrigins||null },
    onchainEvidence: record.evidence || null,
    analysis: result,
  };
}

export function statusDescription(value) {
  return {UNKNOWN:'No reliable external status is available.', PAID:'The external system reports that payment was completed.', FAILED:'The external system reports that payment failed.', PENDING:'The external system is still processing or awaiting payment.'}[normalizeStatus(value)];
}

export function investigationGuidance(record, result) {
  const exact = result.verifiedTransfer && result.verifiedTransfer.actualAmount === result.verifiedTransfer.expectedAmount;
  const simulated = result.dataOrigin === 'DEMO_SIMULATION';
  const verified = exact && !simulated && result.dataOrigin === 'LIVE_RPC';
  const merchant=normalizeStatus(record.merchantStatus), provider=normalizeStatus(record.providerStatus);
  const order=String(record.orderId||'this order');
  const transferLabel=exact ? result.verifiedTransfer.actualAmount+' tokens '+(simulated?'in simulated transfer':'verified on Solana '+record.network) : result.verifiedTransfer ? result.verifiedTransfer.actualAmount+' matching tokens observed; amount differs' : 'Expected token transfer not established';
  let summary=exact ? (simulated?'This simulated scenario shows an expected token transfer.':'The blockchain confirms the expected token transfer to the specified account.')+' Merchant reports '+merchant.toLowerCase()+'; provider reports '+provider.toLowerCase()+'. Both external records are unauthenticated and provider settlement remains unverified.' : 'The expected payment has not been established. '+result.status.label+'. External records must be reviewed separately.';
  let impact=verified ? 'The customer may have transferred tokens while the order still requires attention. Check internal records before changing the order or determining fulfillment. Provider settlement needs separate evidence.' : 'Avoid crediting or rejecting the order based on incomplete or conflicting evidence. Confirm the payment expectation and obtain supporting records.';
  let nextSteps=[];
  switch(result.status.code){
    case 'MISMATCH': nextSteps=['Confirm the token mint, recipient token account and expected amount for '+order+'.','Compare the observed transfers with the invoice; investigate another transaction if needed.','Ask the merchant and provider to explain the mismatch before changing the order.'];break;
    case 'ONCHAIN_FAILED': nextSteps=['Review the transaction execution error on Solana Explorer.','Request a different successful transaction if payment is claimed.','Check paid external claims against the provider ledger before crediting '+order+'.'];break;
    case 'AWAITING_FINALITY': nextSteps=['Wait for finality and re-verify on the selected network.','Keep '+order+' under review until the expected transfer is established.'];break;
    case 'INCONCLUSIVE': nextSteps=['Confirm the transaction signature and Solana network.','Retry verification when RPC is available; unavailable evidence does not mean payment failed.','Request missing order or transaction details before changing '+order+'.'];break;
    case 'RECORDS_ALIGNED': nextSteps=['Retain the blockchain evidence and order-to-payment mapping for '+order+'.','Confirm the reported paid statuses against authenticated merchant and provider records.','Obtain provider settlement evidence before treating the case as settled.'];break;
    default: nextSteps=['Check the merchant order record for '+order+' (reported '+merchant.toLowerCase()+').','Compare the order and expected amount with the saved blockchain transaction.',provider==='UNKNOWN'?'Request the missing provider payment status and settlement evidence.':'Request provider confirmation and settlement evidence for the reported '+provider.toLowerCase()+' status.','Determine whether the order should be updated after reviewing internal records.'];
  }
  if(result.findings.some(f=>f.title.includes('another case')))nextSteps.unshift('Review the other case using this signature before crediting multiple orders.');
  nextSteps.push('Export this evidence report for the finance or support team.');
  return {transferLabel, summary, impact, nextSteps};
}
