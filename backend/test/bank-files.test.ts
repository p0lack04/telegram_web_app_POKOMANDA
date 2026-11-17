import {it,expect} from 'vitest';
import {validateBankFile} from '../src/domain/bank-files.js';
import {ClamAvScanner} from '../src/integrations/bank-files.js';
import {createServer} from 'node:net';
it('rejects traversal/control names and invalid text',async()=>{
 for(const name of ['../x.txt','folder\\x.txt','bad\n.txt'])await expect(validateBankFile(name,'text/plain',Buffer.from('test'))).rejects.toMatchObject({code:'INVALID_FILE_NAME'});
 await expect(validateBankFile('x.txt','text/plain',Buffer.from([0xff,0xfe]))).rejects.toMatchObject({code:'CONTENT_MISMATCH'});
 expect((await validateBankFile('x.txt','text/plain',Buffer.from('Текст\n'))).fileType).toBe('DOCUMENT');
});
it('ClamAV INSTREAM frames bytes and fails closed on unexpected response',async()=>{
 for(const [response,result] of [['stream: OK\0','CLEAN'],['stream: Eicar-Signature FOUND\0','INFECTED'],['stream: size limit ERROR\0','ERROR']] as const){
  let received=Buffer.alloc(0);const server=createServer(socket=>socket.on('data',chunk=>{received=Buffer.concat([received,chunk]);if(received.length>=21)socket.end(response);}));await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const addr=server.address();if(!addr||typeof addr==='string')throw Error('port');
  try{const task=new ClamAvScanner('127.0.0.1',addr.port).scan(Buffer.from('test'));if(result==='ERROR')await expect(task).rejects.toThrow();else expect(await task).toBe(result);expect(received.subarray(0,10).toString()).toBe('zINSTREAM\0');expect(received.readUInt32BE(10)).toBe(4);expect(received.subarray(14,18).toString()).toBe('test');expect(received.readUInt32BE(18)).toBe(0);}finally{await new Promise<void>(r=>server.close(()=>r()));}
 }
});
it('ClamAV closes without a response reject promptly',async()=>{
 const server=createServer(socket=>socket.once('data',()=>socket.destroy()));await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const addr=server.address();if(!addr||typeof addr==='string')throw Error('port');
 try{await expect(new ClamAvScanner('127.0.0.1',addr.port).scan(Buffer.from('test'))).rejects.toThrow();}finally{await new Promise<void>(r=>server.close(()=>r()));}
});
it('ClamAV disconnect during a large stream cannot leave backpressure waiting forever',async()=>{
 const server=createServer(socket=>socket.once('data',()=>socket.destroy()));await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const addr=server.address();if(!addr||typeof addr==='string')throw Error('port');
 try{await expect(new ClamAvScanner('127.0.0.1',addr.port).scan(Buffer.alloc(50*1024*1024,65))).rejects.toThrow();}finally{await new Promise<void>(r=>server.close(()=>r()));}
},5000);
