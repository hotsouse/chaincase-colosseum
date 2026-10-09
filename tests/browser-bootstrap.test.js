import test from 'node:test';
import assert from 'node:assert/strict';

test('browser module renders overview using a minimal DOM shell',async()=>{
  let html='';const handlers={};
  globalThis.document={getElementById:()=>({set innerHTML(v){html=v;},get innerHTML(){return html;}}),addEventListener:(event,callback)=>{handlers[event]=callback;},body:{append(){}}};
  globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
  globalThis.window={scrollTo:()=>{}};
  await import('../public/app.js');
  assert.match(html,/Every payment has a story/);
  assert.match(html,/Recent investigations/);
  assert.match(html,/SIMULATION|Explore sample case/);
  for(const key of ['click','submit','change','input','keydown'])assert.equal(typeof handlers[key],'function');
  delete globalThis.document;delete globalThis.localStorage;delete globalThis.window;
});
