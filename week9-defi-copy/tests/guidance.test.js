import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeCase,investigationGuidance,buildExport,statusDescription} from '../public/engine.js';
const record={id:'case-1',orderId:'ORDER-001',merchantName:'Merchant',network:'devnet',destination:'DEST',mint:'MINT',expectedAmount:'5',merchantStatus:'PENDING',providerStatus:'PAID',verifiedAt:'2026-10-09T10:00:00Z'};
const evidence={source:'LIVE_RPC',state:'FINALIZED_SUCCESS',transfers:[{destination:'DEST',mint:'MINT',rawAmount:'5000000',decimals:6}]};
for(const merchantStatus of ['UNKNOWN','PAID','FAILED','PENDING'])for(const providerStatus of ['UNKNOWN','PAID','FAILED','PENDING'])test('guidance for '+merchantStatus+' / '+providerStatus,()=>{
 const c={...record,merchantStatus,providerStatus};const a=analyzeCase(c,evidence);const g=investigationGuidance(c,a);
 assert.match(g.summary,/unauthenticated/);assert.match(g.summary,/settlement remains unverified/);assert.ok(g.nextSteps.length>=3);assert.ok(statusDescription(merchantStatus));
 const expected=merchantStatus==='FAILED'||providerStatus==='FAILED'?'NEEDS_PROVIDER_REVIEW':merchantStatus==='PAID'&&providerStatus==='PAID'?'RECORDS_ALIGNED':merchantStatus==='PENDING'||providerStatus==='PENDING'?'NEEDS_PROVIDER_REVIEW':'ONCHAIN_VERIFIED';assert.equal(a.status.code,expected);
});
test('recommendations distinguish mismatch, failure, finality and outage',()=>{
 const states=['FINALIZED_FAILED','AWAITING_FINALITY','RPC_UNAVAILABLE','NOT_FOUND'];const first=states.map(state=>investigationGuidance(record,analyzeCase(record,{...evidence,state})).nextSteps[0]);assert.notEqual(first[0],first[1]);assert.notEqual(first[1],first[2]);
 const mismatch=investigationGuidance({...record,expectedAmount:'6'},analyzeCase({...record,expectedAmount:'6'},evidence));assert.match(mismatch.nextSteps[0],/mint/);assert.doesNotMatch(mismatch.transferLabel,/verified/);
});
test('simulation never gets a live verification headline',()=>{const g=investigationGuidance(record,analyzeCase(record,{...evidence,source:'DEMO_SIMULATION'}));assert.match(g.transferLabel,/simulated/);assert.doesNotMatch(g.transferLabel,/verified on/);});
test('JSON evidence export preserves audit metadata, recommendations and verifier data',()=>{const c={...record,evidence,claimOrigins:{merchantStatus:{source:'IMPORTED_JSON',fileName:'claims.json'}}};const report=JSON.parse(JSON.stringify(buildExport(c,analyzeCase(c,evidence))));assert.equal(report.caseId,c.id);assert.equal(report.audit.verifiedAt,c.verifiedAt);assert.deepEqual(report.onchainEvidence,evidence);assert.ok(report.executiveSummary.nextSteps.length);assert.equal(report.claims.origins.merchantStatus.fileName,'claims.json');});
