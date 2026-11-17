import {createConnection} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';

// Only the isolated compose test services; no environment-supplied production URL.
function scannerReady(){return new Promise(resolve=>{
 const socket=createConnection({host:'127.0.0.1',port:13310});
 let response='';const finish=ready=>{socket.destroy();resolve(ready);};
 socket.setTimeout(3000,()=>finish(false));socket.on('error',()=>finish(false));
 socket.on('connect',()=>socket.write('zPING\0'));
 socket.on('data',chunk=>{response+=chunk.toString();if(response.includes('\0'))finish(response==='PONG\0');});
 socket.on('end',()=>finish(false));
});}
const deadline=Date.now()+300000;
let ready=false;
while(Date.now()<deadline){
 const storage=await fetch('http://127.0.0.1:19000/minio/health/ready',{signal:AbortSignal.timeout(3000)}).then(r=>r.ok).catch(()=>false);
 if(storage&&await scannerReady()){ready=true;break;}
 await delay(5000);
}
if(!ready)throw Error('Isolated S3/ClamAV test services did not become ready');
console.info('Isolated S3/ClamAV test services are ready');
