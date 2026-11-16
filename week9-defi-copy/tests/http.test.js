import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppServer } from '../server/index.js';

let server,base;
test.before(async()=>{
  server=createAppServer({jupiterCooldownMs:0,quoteJupiter:async input=>({source:'JUPITER_SWAP_API_V2',network:'mainnet-beta',inputMint:input.mint,outputMint:'USDC',inAmount:input.amount,outAmount:'1234567',feeBps:0,transactionCreated:false}),verify:async input=>({source:'LIVE_RPC',state:'FINALIZED_SUCCESS',signature:input.signature,network:input.network,transfers:[{destination:'1'.repeat(32),mint:'1'.repeat(32),rawAmount:'50000000'}]})});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
});
test.after(async()=>{await new Promise(resolve=>server.close(resolve));});
test('serves the app HTML and JavaScript modules',async()=>{
  const r=await fetch(base+'/');assert.equal(r.status,200);assert.match(await r.text(),/ChainCase/);
  const js=await fetch(base+'/engine.js');assert.equal(js.status,200);assert.match(await js.text(),/analyzeCase/);
});
test('health endpoint accurately describes stateless backend',async()=>{
  const r=await fetch(base+'/api/health');assert.equal(r.status,200);const data=await r.json();assert.equal(data.persistence,'browser-local');
});
test('blocks unsupported API methods and invalid signatures',async()=>{
  const r=await fetch(base+'/api/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({signature:'bad',network:'devnet'})});
  assert.equal(r.status,400);assert.match((await r.json()).error,/Signature/);
});
test('Jupiter quote API validates mainnet input and returns quote-only data',async()=>{
  const r=await fetch(base+'/api/defi/quote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({network:'mainnet-beta',signature:'1'.repeat(64),mint:'1'.repeat(32),destination:'1'.repeat(32),amount:'50000000'})});
  assert.equal(r.status,200);const q=await r.json();assert.equal(q.source,'JUPITER_SWAP_API_V2');assert.equal(q.transactionCreated,false);assert.equal(q.outAmount,'1234567');
  const mismatch=await fetch(base+'/api/defi/quote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({network:'mainnet-beta',signature:'1'.repeat(64),mint:'1'.repeat(32),destination:'1'.repeat(32),amount:'50000001'})});
  assert.equal(mismatch.status,409);
  const bad=await fetch(base+'/api/defi/quote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({network:'devnet',signature:'1'.repeat(64),mint:'1'.repeat(32),destination:'1'.repeat(32),amount:'50000000'})});
  assert.equal(bad.status,400);
});
test('rejects malformed oversized API body',async()=>{
  const r=await fetch(base+'/api/verify',{method:'POST',headers:{'content-type':'application/json'},body:'{invalid-json}'});assert.equal(r.status,400);
  const oversized=await fetch(base+'/api/verify',{method:'POST',headers:{'content-type':'application/json'},body:'x'.repeat(5000)});assert.equal(oversized.status,413);
});
test('returns not found for private server source',async()=>{
  const r=await fetch(base+'/server/rpc.js');assert.equal(r.status,404);
});
test('has security headers',async()=>{
  const r=await fetch(base+'/');assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.match(r.headers.get('content-security-policy'),/script-src 'self'/);
});

test('analytics endpoints return wallet, pagination, program and network data',async()=>{
  let walletArgs;
  const app=createAppServer({
    walletOverview:async(...args)=>{walletArgs=args;return {address:args[0],network:args[1],solBalance:'1.25',tokenAccounts:[],recentTransactions:[],hasMoreTransactions:false};},
    programActivity:async(programId,network)=>({programId,network,recentSignatures:[],note:'limited RPC history'}),
    networkInfo:async(network)=>({network,rpcConnectionStatus:'connected',latestObservedSlot:8}),
  });
  await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${app.address().port}`;
  try {
    const wallet=await fetch(origin+'/api/analytics/wallet',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address:'1'.repeat(32),network:'devnet',before:'2'.repeat(64),limit:5})});
    assert.equal(wallet.status,200);assert.equal((await wallet.json()).solBalance,'1.25');assert.equal(walletArgs[2].before,'2'.repeat(64));
    const program=await fetch(origin+'/api/analytics/program',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({programId:'3'.repeat(32),network:'mainnet-beta'})});
    assert.equal(program.status,200);assert.equal((await program.json()).programId,'3'.repeat(32));
    const network=await fetch(origin+'/api/analytics/network',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({network:'devnet'})});
    assert.equal((await network.json()).rpcConnectionStatus,'connected');
  } finally { await new Promise(resolve=>app.close(resolve)); }
});
