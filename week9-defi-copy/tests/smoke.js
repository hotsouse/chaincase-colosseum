import { createAppServer } from '../server/index.js';
const server=createAppServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
try{
  for(const path of ['/','/app.js','/engine.js','/csv.js','/style.css','/favicon.svg','/api/health']){
    const response=await fetch(base+path);
    if(response.status!==200)throw Error(`${path}: ${response.status}`);
    console.log(`OK ${path}`);
  }
  const invalid=await fetch(base+'/api/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({signature:'invalid',network:'devnet'})});
  if(invalid.status!==400)throw Error('API did not reject invalid signature');
  console.log('OK invalid transaction rejected');
  console.log('HTTP smoke check successful. Note: public Solana RPC connectivity was not tested.');
}finally{await new Promise(resolve=>server.close(resolve));}
