import test from 'node:test';
import assert from 'node:assert/strict';

test('DOM event wiring navigates, opens a clearly labeled demo, and shows evidence/report tabs',async()=>{
  const handlers = {};
  const root = { innerHTML:'' };
  const browserStore = new Map();
  const originalTimer=globalThis.setTimeout;
  globalThis.setTimeout=(callback)=>{callback();return 0;};
  globalThis.localStorage={getItem:key=>browserStore.get(key)||null,setItem:(key,val)=>browserStore.set(key,val)};
  globalThis.window={scrollTo(){} ,print(){}};
  globalThis.document={
    getElementById:(id)=>id==='app'?root:null,
    addEventListener:(name,handler)=>{handlers[name]=handler;},
    createElement:()=>({textContent:'',className:'',setAttribute(){},remove(){}}),
    body:{append(){}},
  };
  const click=(selector,data)=>handlers.click({target:{closest:(query)=>query===selector?{dataset:data}:null}});
  try{
    await import('../public/app.js');
    assert.match(root.innerHTML,/Recent investigations/);
    await click('[data-page]',{page:'new'});
    assert.match(root.innerHTML,/id="new-case-form"/);
    await click('[data-action]',{action:'demo',kind:'conflict'});
    assert.match(root.innerHTML,/SIMULATION/);
    assert.match(root.innerHTML,/Offchain status conflict/);
    assert.equal(JSON.parse(browserStore.get('chaincase:v1:cases')).length,1);
    await click('[data-tab]',{tab:'evidence'});
    assert.match(root.innerHTML,/Blockchain facts vs\. external claims/);
    await click('[data-tab]',{tab:'report'});
    assert.match(root.innerHTML,/Payment investigation report/);
    await click('[data-page]',{page:'guide'});
    assert.match(root.innerHTML,/Underpayment sample/);
  }finally{
    globalThis.setTimeout=originalTimer;
    delete globalThis.localStorage;delete globalThis.window;delete globalThis.document;
  }
});
