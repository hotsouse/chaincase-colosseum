import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppServer } from '../server/index.js';

let server,base;
test.before(async()=>{
  server=createAppServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
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
