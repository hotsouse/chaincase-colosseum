import test from 'node:test';
import assert from 'node:assert/strict';
import { amountToRaw, formatRaw, analyzeCase, buildExport } from '../public/engine.js';

const record = () => ({ id:'1', network:'devnet', signature:'sample-transaction', orderId:'INV-001',merchantName:'Example', destination:'DEST',mint:'MINT',expectedAmount:'50',merchantStatus:'FAILED',providerStatus:'PAID' });
const evidence = (overrides={}) => ({source:'LIVE_RPC',state:'FINALIZED_SUCCESS',signature:'sample-transaction',network:'devnet',warnings:[],transfers:[{destination:'DEST',mint:'MINT',rawAmount:'50000000',decimals:6}],...overrides});

test('exact decimal arithmetic (no floating point)',()=>{
  assert.equal(amountToRaw('0.000001',6),1n);
  assert.equal(amountToRaw('50.000000',6),50000000n);
  assert.equal(formatRaw(50000001n,6),'50.000001');
  assert.equal(formatRaw(0n,6),'0');
  assert.throws(()=>amountToRaw('1.0000001',6),/precision/);
  assert.throws(()=>amountToRaw('0',6),/exceed zero/);
});
test('verified transfer plus failed merchant status needs provider review',()=>{
  const result=analyzeCase(record(),evidence());
  assert.equal(result.status.code,'NEEDS_PROVIDER_REVIEW');
  assert.equal(result.verifiedTransfer.actualAmount,'50');
});
test('underpayment is a mismatch',()=>{
  const result=analyzeCase(record(),evidence({transfers:[{destination:'DEST',mint:'MINT',rawAmount:'35000000',decimals:6}]}));
  assert.equal(result.status.code,'MISMATCH');
  assert.match(result.findings[0].title,/below/);
});
test('overpayment is a mismatch',()=>{
  const result=analyzeCase(record(),evidence({transfers:[{destination:'DEST',mint:'MINT',rawAmount:'70000000',decimals:6}]}));
  assert.equal(result.status.code,'MISMATCH');
});
test('does not count a payment to a different token account',()=>{
  const result=analyzeCase(record(),evidence({transfers:[{destination:'OTHER',mint:'MINT',rawAmount:'50000000',decimals:6}]}));
  assert.equal(result.status.code,'MISMATCH');
  assert.equal(result.verifiedTransfer,null);
});
test('wrong mint is a mismatch',()=>{
  const result=analyzeCase(record(),evidence({transfers:[{destination:'DEST',mint:'OTHER',rawAmount:'50000000',decimals:6}]}));
  assert.equal(result.status.label,'Token mismatch');
});
test('record alignment does not imply independently authenticated settlement',()=>{
  const c={...record(),merchantStatus:'PAID',providerStatus:'PAID'};
  const result=analyzeCase(c,evidence());
  assert.equal(result.status.code,'RECORDS_ALIGNED');
  assert.match(result.findings[1].detail,/independently authenticated/);
});
test('unknown offchain statuses do not become matched',()=>{
  const c={...record(),merchantStatus:'UNKNOWN',providerStatus:'UNKNOWN'};
  assert.equal(analyzeCase(c,evidence()).status.code,'ONCHAIN_VERIFIED');
});
test('finalized failed transaction never represents successful payment',()=>{
  const result=analyzeCase(record(),evidence({state:'FINALIZED_FAILED',transfers:[]}));
  assert.equal(result.status.code,'ONCHAIN_FAILED');
});
test('pending is not incorrectly marked failed',()=>{
  assert.equal(analyzeCase(record(),evidence({state:'AWAITING_FINALITY',transfers:[]})).status.code,'AWAITING_FINALITY');
});
test('RPC outage is inconclusive',()=>{
  assert.equal(analyzeCase(record(),evidence({state:'RPC_UNAVAILABLE',transfers:[]})).status.code,'INCONCLUSIVE');
});
test('duplicate transaction signature flagged for investigation',()=>{
  const r=analyzeCase(record(),evidence(),[{id:'2',signature:'sample-transaction',network:'devnet'}]);
  assert.ok(r.findings.some(x=>x.title.includes('another case')));
});
test('multiple matching transfers sum correctly',()=>{
  const r=analyzeCase(record(),evidence({transfers:[{destination:'DEST',mint:'MINT',rawAmount:'20000000',decimals:6},{destination:'DEST',mint:'MINT',rawAmount:'30000000',decimals:6}]}));
  assert.equal(r.verifiedTransfer.actualAmount,'50');
  assert.equal(r.verifiedTransfer.transferCount,2);
});
test('report identifies user supplied claims and source',()=>{
  const r=buildExport({...record(),evidence:evidence()},analyzeCase(record(),evidence()));
  assert.equal(r.onchainEvidence.source,'LIVE_RPC');
  assert.match(r.caution,/independently authenticated/);
});
