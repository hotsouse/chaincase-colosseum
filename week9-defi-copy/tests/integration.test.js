import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { analyzeCase } from '../public/engine.js';

const signature = '1'.repeat(64);
const destination = '2'.repeat(44);
const mint = '1'.repeat(32);
const source = '3'.repeat(44);
function listen(server){return new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));}
function close(server){return new Promise(resolve=>server.close(resolve));}

test('HTTP API -> mocked JSON-RPC -> analyzer: full verification slice',async()=>{
  const mock=createServer(async(req,res)=>{
    let data='';for await (const c of req)data+=c;
    const payload=JSON.parse(data);
    assert.equal(payload.method,'getTransaction');
    assert.equal(payload.params[1].commitment,'finalized');
    const result={
      slot:50001,blockTime:1760000000,meta:{err:null,preTokenBalances:[],postTokenBalances:[],innerInstructions:[]},
      transaction:{message:{accountKeys:[],instructions:[{program:'spl-token',parsed:{type:'transferChecked',info:{source,destination,mint,tokenAmount:{amount:'50000000',decimals:6}}}}]}}
    };
    res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({jsonrpc:'2.0',id:1,result}));
  });
  await listen(mock);
  process.env.SOLANA_DEVNET_RPC=`http://127.0.0.1:${mock.address().port}`;
  const { createAppServer }=await import('../server/index.js?integration-rpc');
  const app=createAppServer();await listen(app);
  try{
    const r=await fetch(`http://127.0.0.1:${app.address().port}/api/verify`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({network:'devnet',signature})});
    assert.equal(r.status,200);
    const evidence=await r.json();
    assert.equal(evidence.source,'LIVE_RPC'); // Means JSON-RPC origin, here mocked by this test.
    assert.equal(evidence.transfers.length,1);
    const c={id:'case-1',signature,network:'devnet',expectedAmount:'50',destination,mint,merchantStatus:'FAILED',providerStatus:'PAID'};
    assert.equal(analyzeCase(c,evidence).status.code,'NEEDS_PROVIDER_REVIEW');
  }finally{await close(app);await close(mock);delete process.env.SOLANA_DEVNET_RPC;}
});
