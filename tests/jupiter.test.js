import test from 'node:test';
import assert from 'node:assert/strict';
import { getJupiterQuote, validateQuoteInput, USDC_MINT } from '../server/jupiter.js';

const mint='So11111111111111111111111111111111111111112';
const signature='1'.repeat(64);
const destination='1'.repeat(32);
const input={network:'mainnet-beta',signature,mint,destination,amount:'1000000'};

test('Jupiter quote input is restricted to mainnet and positive raw units',()=>{
  assert.deepEqual(validateQuoteInput(input),{signature,network:'mainnet-beta',mint,destination,amount:'1000000'});
  assert.throws(()=>validateQuoteInput({...input,network:'devnet'}),/mainnet-beta/);
  assert.throws(()=>validateQuoteInput({...input,mint:'bad'}),/mint/);
  assert.throws(()=>validateQuoteInput({...input,destination:'bad'}),/recipient/);
  assert.throws(()=>validateQuoteInput({...input,amount:'0'}),/positive/);
  assert.throws(()=>validateQuoteInput({...input,amount:'1.5'}),/raw token/);
  assert.throws(()=>validateQuoteInput({...input,signature:'bad'}),/64-byte/);
});

test('Jupiter quote calls official v2 endpoint without a taker or transaction',async()=>{
  let requested;
  const quote=await getJupiterQuote(input,{fetcher:async(url,options)=>{
    requested={url:String(url),options};return {ok:true,json:async()=>({outAmount:'1234000',feeBps:0,router:'metis'})};
  }});
  assert.match(requested.url,/api\.jup\.ag\/swap\/v2\/order/);
  assert.match(requested.url,/inputMint=/);assert.match(requested.url,/outputMint=/);
  assert.doesNotMatch(requested.url,/taker=/);assert.equal(requested.options.headers.accept,'application/json');
  assert.equal(quote.outAmount,'1234000');assert.equal(quote.transactionCreated,false);assert.equal(quote.router,'metis');
});

test('Jupiter errors and missing routes never become a fabricated quote',async()=>{
  await assert.rejects(()=>getJupiterQuote({...input,amount:'1'},{fetcher:async()=>({ok:false,status:429})}),e=>e.status===503);
  await assert.rejects(()=>getJupiterQuote({...input,amount:'1'},{fetcher:async()=>({ok:true,json:async()=>({error:'route unavailable'})})}),e=>e.status===503);
  await assert.rejects(()=>getJupiterQuote({...input,mint:USDC_MINT,amount:'1'}),/already USDC/);
});
