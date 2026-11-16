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
    const saved=()=>JSON.parse(browserStore.get('chaincase:v1:cases'))[0];
    const originalEvidence=JSON.stringify(saved().evidence);const originalTime=saved().verifiedAt;
    for(const value of ['UNKNOWN','PAID','FAILED','PENDING']){await handlers.change({target:{dataset:{claim:'merchantStatus'},value}});assert.equal(saved().merchantStatus,value);assert.equal(JSON.stringify(saved().evidence),originalEvidence);assert.equal(saved().verifiedAt,originalTime);}
    for(const name of ['claims.csv','claims.json']){const c=saved();const text=name.endsWith('.json')?JSON.stringify([{order_id:c.orderId,merchant_status:'PENDING',provider_status:'PAID'}]):'order_id,merchant_status,provider_status\n'+c.orderId+',PENDING,PAID';await handlers.change({target:{id:'csv-file',files:[{name,size:text.length,text:async()=>text}]}});assert.equal(saved().claimFileName,name);assert.equal(saved().merchantStatus,'PENDING');assert.equal(JSON.stringify(saved().evidence),originalEvidence);}
    await handlers.change({target:{dataset:{claim:'merchantStatus'},value:'FAILED'}});assert.equal(saved().claimOrigins.providerStatus.source,'IMPORTED_JSON');assert.equal(saved().claimOrigins.merchantStatus.source,'MANUALLY_MODIFIED');
    const beforeInvalid=JSON.stringify(saved());await handlers.change({target:{id:'csv-file',files:[{name:'bad.json',size:4,text:async()=> 'null'}]}});assert.equal(JSON.stringify(saved()),beforeInvalid);

    await click('[data-tab]',{tab:'report'});
    assert.match(root.innerHTML,/Payment investigation report/);for(const label of ['Executive summary','Transaction verification','Status comparison','Discrepancy analysis','Recommended next steps','Evidence &amp; limitations','Audit metadata'])assert.ok(root.innerHTML.includes(label.replace('&amp;','&')),label);
    await click('[data-page]',{page:'guide'});
    assert.match(root.innerHTML,/Underpayment sample/);
  }finally{
    globalThis.setTimeout=originalTimer;
    delete globalThis.localStorage;delete globalThis.window;delete globalThis.document;
  }
});
