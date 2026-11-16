import {spawn} from 'node:child_process';
import {mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createAppServer} from '../server/index.js';
const server=createAppServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const profile=await mkdtemp(join(tmpdir(),'chaincase-qa-'));
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let socket;const pending=new Map();let id=0;const errors=[];
try{
const endpoint=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('Chrome startup timeout')),15000);chrome.stderr.on('data',data=>{out+=data;const m=out.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m){clearTimeout(timer);resolve(m[1]);}});chrome.on('error',reject);});
const origin=endpoint.replace('ws:','http:').split('/devtools')[0];const pages=await(await fetch(origin+'/json/list')).json();socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);});
function send(method,params={}){return new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});socket.send(JSON.stringify({id:key,method,params}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
await send('Runtime.enable');await send('Page.enable');await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port});await evaluate('new Promise(resolve=>{const poll=()=>document.querySelector(".hero")?resolve(true):setTimeout(poll,50);poll();})');
await mkdir('assets/qa',{recursive:true});
const checks=[];
async function check(name,expression){assert.equal(await evaluate(expression),true,name);checks.push(name);}
for(const width of [1440,1024,390]){
await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
await check('overview fits '+width,'document.documentElement.scrollWidth<=window.innerWidth');
await evaluate(`document.querySelector('[data-page="new"]').click()`);await check('form fits '+width,'document.documentElement.scrollWidth<=window.innerWidth');
await check('readable input '+width,'parseFloat(getComputedStyle(document.querySelector(".field input")).fontSize)>=16');
await evaluate(`document.querySelector('[data-action="demo"]').click()`);
await check('result fits '+width,'document.documentElement.scrollWidth<=window.innerWidth');
const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile('assets/qa/result-'+width+'.png',Buffer.from(shot.data,'base64'));
await evaluate(`document.querySelector('[data-tab="report"]').click()`);await check('report fits '+width,'document.documentElement.scrollWidth<=window.innerWidth');
await evaluate(`document.querySelector('[data-page="investigations"]').click()`);await check('table contained '+width,'document.documentElement.scrollWidth<=window.innerWidth');
await evaluate(`document.querySelector('[data-page="overview"]').click()`);
}
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
await evaluate(`document.querySelector('[data-action="demo"]').click();document.querySelector('[data-tab="report"]').click()`);
await evaluate(`document.querySelector('[data-page="new"]').click();const values={merchantName:'Devnet verification',orderId:'ORDER-001',expectedAmount:'5',network:'devnet',signature:'2KY1P44tBb7SPaCWuZcYHMbPfyzs4yNFsfRgEq83Ma7Tz7jVks6XNYmeh7NyBKgdRkrpX8nbMv4ScsokHEmsRcVe',destination:'EqDkFinfZDw9VNNwZ3PhZjKGQXS8mgbqRJ4oZxCiXiB5',mint:'F5PfVvib1Skj7LZqNPP5ZWirdq4jaaG2Fz4fr37NVquq',merchantStatus:'PENDING',providerStatus:'PAID'};for(const [name,value] of Object.entries(values))document.getElementById(name).value=value;document.getElementById('new-case-form').requestSubmit();`);
await evaluate('new Promise((resolve,reject)=>{const started=Date.now();const poll=()=>{const c=JSON.parse(localStorage.getItem("chaincase:v1:cases"))[0];if(c.evidence||c.lastVerificationError)resolve(c);else if(Date.now()-started>20000)reject(Error("Verification timeout"));else setTimeout(poll,100);};poll();})');
const live=await evaluate('JSON.parse(localStorage.getItem("chaincase:v1:cases"))[0]');
if(live.lastVerificationError)throw Error('Live browser verification unavailable: '+live.lastVerificationError);
await check('live transfer headline','document.body.innerText.includes("5 tokens verified on Solana devnet")');await check('live reconciliation result','document.body.innerText.includes("Awaiting offchain reconciliation")');
await writeFile('assets/qa/live-case.json',JSON.stringify(live,null,2));
await evaluate(`document.querySelector('[data-tab="report"]').click()`);
await check('live report has actual order','document.querySelector(".report-document").innerText.includes("ORDER-001")');
await send('Emulation.setEmulatedMedia',{media:'print'});await check('report visible in print','document.querySelector(".print-section").getBoundingClientRect().height>100');await check('navigation hidden in print','getComputedStyle(document.querySelector(".sidebar")).display==="none"');
const pdf=await send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true});await writeFile('assets/qa/devnet-report.pdf',Buffer.from(pdf.data,'base64'));
assert.equal(errors.length,0,'browser exceptions');checks.push('No browser runtime exceptions');await writeFile('assets/qa/browser-checks.json',JSON.stringify({checkedAt:new Date().toISOString(),checks,errors},null,2));console.log(checks.length+' browser checks passed; screenshots and live Devnet PDF in assets/qa');
}finally{if(socket)socket.close();chrome.kill();await new Promise(r=>server.close(r));}
