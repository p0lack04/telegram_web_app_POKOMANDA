import {S3Client,PutObjectCommand,GetObjectCommand,DeleteObjectCommand,ListObjectsV2Command} from '@aws-sdk/client-s3';
import {createConnection} from 'node:net';
import {once} from 'node:events';
import type {Config} from '../config.js';
import {MEDIA_LIMIT} from '../domain/bank-files.js';

export interface FileStorage {put(key:string,bytes:Buffer,mime:string):Promise<void>;get(key:string):Promise<Buffer>;remove(key:string):Promise<void>;keys():AsyncIterable<string>}
export interface FileScanner {scan(bytes:Buffer):Promise<'CLEAN'|'INFECTED'>}
export interface FileDependencies {storage:FileStorage;scanner:FileScanner}
export class S3FileStorage implements FileStorage {
 private client:S3Client;
 constructor(private bucket:string,config:{endpoint:string;region:string;accessKeyId:string;secretAccessKey:string}){
  this.client=new S3Client({endpoint:config.endpoint,region:config.region,forcePathStyle:true,credentials:{accessKeyId:config.accessKeyId,secretAccessKey:config.secretAccessKey},maxAttempts:3});
 }
 private signal(){return {abortSignal:AbortSignal.timeout(30000)};}
 async put(key:string,bytes:Buffer,mime:string){await this.client.send(new PutObjectCommand({Bucket:this.bucket,Key:key,Body:bytes,ContentType:mime}),this.signal());}
 async get(key:string){
  const out=await this.client.send(new GetObjectCommand({Bucket:this.bucket,Key:key}),this.signal());
  if(!out.Body||!out.ContentLength||out.ContentLength>MEDIA_LIMIT)throw Error('Invalid object');
  const chunks:Buffer[]=[];let length=0;
  for await(const chunk of out.Body as AsyncIterable<Uint8Array>){length+=chunk.length;if(length>MEDIA_LIMIT)throw Error('Invalid object');chunks.push(Buffer.from(chunk));}
  if(length!==out.ContentLength)throw Error('Incomplete object');return Buffer.concat(chunks,length);
 }
 async remove(key:string){await this.client.send(new DeleteObjectCommand({Bucket:this.bucket,Key:key}),this.signal());}
 async *keys(){let token:string|undefined;do{const out=await this.client.send(new ListObjectsV2Command({Bucket:this.bucket,Prefix:'bank/',ContinuationToken:token,MaxKeys:1000}),this.signal());for(const item of out.Contents??[])if(item.Key)yield item.Key;token=out.IsTruncated?out.NextContinuationToken:undefined;}while(token);}
}
export class ClamAvScanner implements FileScanner {
 constructor(private host:string,private port:number){}
 async scan(bytes:Buffer):Promise<'CLEAN'|'INFECTED'>{
  const socket=createConnection({host:this.host,port:this.port});
  const abort=new AbortController();
  socket.once('close',()=>abort.abort());
  const timer=setTimeout(()=>{abort.abort();socket.destroy(Error('Scanner timeout'));},60000);
  try{
   const response=new Promise<string>((resolve,reject)=>{let data='';socket.on('data',chunk=>{data+=chunk.toString('utf8');if(data.length>4096){reject(Error('Invalid scanner response'));socket.destroy();}else if(data.includes('\0'))resolve(data.slice(0,data.indexOf('\0')));});socket.once('error',reject);socket.once('end',()=>reject(Error('Incomplete scanner response')));socket.once('close',()=>reject(Error('Scanner connection closed')));});
   // Attach the rejection handler before sending to avoid an unhandled connection failure.
   void response.catch(()=>{});
   await once(socket,'connect',{signal:abort.signal});socket.write('zINSTREAM\0');
   for(let start=0;start<bytes.length;start+=65536){const chunk=bytes.subarray(start,start+65536);const size=Buffer.alloc(4);size.writeUInt32BE(chunk.length);if(!socket.write(Buffer.concat([size,chunk])))await once(socket,'drain',{signal:abort.signal});}
   socket.write(Buffer.alloc(4));const result=await response;
   if(result==='stream: OK')return 'CLEAN';if(/^stream: .+ FOUND$/.test(result))return 'INFECTED';throw Error('Scanner rejected stream');
  }finally{clearTimeout(timer);socket.destroy();}
 }
}
export function fileDependencies(config:Config):FileDependencies|undefined {
 if(!config.S3_ENDPOINT||!config.S3_BUCKET||!config.S3_ACCESS_KEY_ID||!config.S3_SECRET_ACCESS_KEY||!config.CLAMAV_HOST)return undefined;
 return {storage:new S3FileStorage(config.S3_BUCKET,{endpoint:config.S3_ENDPOINT,region:config.S3_REGION??'us-east-1',accessKeyId:config.S3_ACCESS_KEY_ID,secretAccessKey:config.S3_SECRET_ACCESS_KEY}),scanner:new ClamAvScanner(config.CLAMAV_HOST,config.CLAMAV_PORT??3310)};
}
