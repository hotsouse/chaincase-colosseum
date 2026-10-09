import test from 'node:test';
import assert from 'node:assert/strict';
import { isSolanaAddress, validateVerificationInput, readTransfers, verifyTransaction } from '../server/rpc.js';

const sig='1'.repeat(64);
const mint='1'.repeat(32);
const destination='3'.repeat(32);
const source='4'.repeat(32);
const txn = (state=null)=>({
  slot: 12345,blockTime: 1760000000,
  meta: {err:state, preTokenBalances:[{accountIndex:1,mint,uiTokenAmount:{decimals:6}}],postTokenBalances:[{accountIndex:2,mint,uiTokenAmount:{decimals:6}}],innerInstructions:[]},
  transaction:{message:{accountKeys:[{pubkey:'5'.repeat(32)},{pubkey:source},{pubkey:destination}],instructions:[{program:'spl-token',parsed:{type:'transferChecked',info:{source,destination,mint,tokenAmount:{amount:'50000000',decimals:6}}}}]}}
});
function fakeRpc(data) {
  let count=0;
  return async (_url,opts)=>{
    const req=JSON.parse(opts.body);count++;
    const result=req.method==='getTransaction'?data:({value:[{confirmationStatus:'confirmed'}]});
    return {ok:true,json:async()=>({jsonrpc:'2.0',result})};
  };
}
test('signature and address validator enforces decoded byte length',()=>{
  assert.equal(isSolanaAddress(sig,64),true);
  assert.equal(isSolanaAddress(mint,32),true);
  assert.equal(isSolanaAddress('not-base58%%',32),false);
  assert.throws(()=>validateVerificationInput({signature:'invalid',network:'devnet'}),/Signature/);
  assert.throws(()=>validateVerificationInput({signature:sig,network:'other'}),/Unsupported/);
});
test('read parsed transferChecked exact amount',()=>{
  const data=readTransfers(txn());
  assert.deepEqual(data.transfers[0],{source,destination,mint,decimals:6,rawAmount:'50000000',parsedType:'transferChecked'});
});
test('parse unchecked SPL token transfer via token balances',()=>{
  const t=txn();t.transaction.message.instructions[0].parsed={type:'transfer',info:{source,destination,amount:'25000000'}};
  assert.equal(readTransfers(t).transfers[0].mint,mint);
  assert.equal(readTransfers(t).transfers[0].decimals,6);
});
test('native SOL transfers are excluded',()=>{
  const t=txn();t.transaction.message.instructions[0].program='system';
  assert.equal(readTransfers(t).transfers.length,0);
});
test('verified finalized transaction yields RPC evidence',async()=>{
  const actual=await verifyTransaction({signature:sig,network:'devnet'},{rpcUrl:'http://mock.local',fetcher:fakeRpc(txn())});
  assert.equal(actual.state,'FINALIZED_SUCCESS');
  assert.equal(actual.slot,12345);
  assert.equal(actual.transfers[0].rawAmount,'50000000');
  assert.match(actual.explorerUrl,/cluster=devnet/);
});
test('failed execution never returns successful transfer evidence',async()=>{
  const actual=await verifyTransaction({signature:sig,network:'devnet'},{rpcUrl:'http://mock.local',fetcher:fakeRpc(txn({InstructionError:[0,'Custom']}))});
  assert.equal(actual.state,'FINALIZED_FAILED');
  assert.equal(actual.transfers.length,0);
});
test('no finalized transaction but confirmation exists: pending',async()=>{
  const actual=await verifyTransaction({signature:sig,network:'devnet'},{rpcUrl:'http://mock.local',fetcher:fakeRpc(null)});
  assert.equal(actual.state,'AWAITING_FINALITY');
});
test('RPC outage gets safe 503 error',async()=>{
  await assert.rejects(()=>verifyTransaction({signature:sig,network:'devnet'},{rpcUrl:'http://mock.local',fetcher:async()=>{throw Error('network secret');}}),e=>e.status===503 && !e.message.includes('secret'));
});
