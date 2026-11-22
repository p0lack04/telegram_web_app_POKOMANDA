import {beforeAll,afterAll,it,expect} from 'vitest';
import {PrismaClient,type User} from '@prisma/client';
import EmbeddedPostgres from 'embedded-postgres';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:net';
import {execFileSync} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import type {FastifyInstance} from 'fastify';
import {buildApp} from '../src/app.js';
import {hashToken} from '../src/services/auth.js';
import {BankFilesService} from '../src/services/bank-files.js';
import {S3FileStorage,ClamAvScanner,type FileDependencies} from '../src/integrations/bank-files.js';
const origin='http://localhost:5173';let pg:EmbeddedPostgres,db:PrismaClient,app:FastifyInstance;
let admin:User,author:User,stranger:User,pending:User,event:string,privateEvent:string;
const cookies=new Map<string,string>(),objects=new Map<string,Buffer>();
let scan:'CLEAN'|'INFECTED'|'ERROR'='CLEAN',storageFailure=false,deleteFailure=false;
const files:FileDependencies={storage:{async put(key,bytes){if(storageFailure)throw Error('secret storage password');objects.set(key,bytes);},async get(key){if(storageFailure||!objects.has(key))throw Error('secret storage password');return objects.get(key)!;},async remove(key){if(deleteFailure)throw Error('secret storage password');objects.delete(key);},async *keys(){yield*objects.keys();}},scanner:{async scan(){if(scan==='ERROR')throw Error('secret scanner');return scan;}}};
async function user(n:number,role:User['role'],active=true){const u=await db.user.create({data:{telegramId:BigInt(n),firstName:'Synthetic',role,isOnboarded:true,accountStatus:active?'CONFIRMED':'PENDING'}});const token=randomBytes(32).toString('base64url');await db.session.create({data:{userId:u.id,tokenHash:hashToken(token),expiresAt:new Date(Date.now()+3600000)}});cookies.set(u.id,`komanda_session=${token}`);return u;}
const request=(actor:User,path:string,method:'GET'|'POST'|'DELETE'='GET',payload?:object)=>app.inject({url:path,method,headers:{origin,cookie:cookies.get(actor.id)!},...(payload?{payload}:{})});
const base=()=>`/api/bank-events/${event}/files`;
function upload(actor:User=admin,target=event,key=randomUUID(),name='test.txt',mime='text/plain',bytes=Buffer.from('Synthetic test')){const boundary='test-boundary';return app.inject({url:`/api/bank-events/${target}/files`,method:'POST',headers:{origin,cookie:cookies.get(actor.id)!,'idempotency-key':key,'content-type':`multipart/form-data; boundary=${boundary}`},payload:Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: ${mime}\r\n\r\n`),bytes,Buffer.from(`\r\n--${boundary}--\r\n`)])});}
beforeAll(async()=>{
 const listener=createServer();await new Promise<void>(r=>listener.listen(0,'127.0.0.1',r));const address=listener.address();if(!address||typeof address==='string')throw Error('port');const port=address.port;await new Promise<void>(r=>listener.close(()=>r()));
 const password=randomBytes(20).toString('hex'),dir=await mkdtemp(join(tmpdir(),'komanda-files-'));
 pg=new EmbeddedPostgres({databaseDir:join(dir,'data'),user:'postgres',password,port,persistent:false,autoRehydrateSymlinks:true,postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{}});await pg.initialise();await pg.start();await pg.createDatabase('files');const url=`postgresql://postgres:${password}@127.0.0.1:${port}/files`;db=new PrismaClient({datasources:{db:{url}}});
 execFileSync(process.execPath,[resolve('../node_modules/prisma/build/index.js'),'migrate','deploy','--schema',resolve('prisma/schema.prisma')],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
 app=await buildApp({NODE_ENV:'test',HOST:'127.0.0.1',PORT:3001,DATABASE_URL:url,APP_ORIGIN:origin,TELEGRAM_BOT_TOKEN:'123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijk'},db,files);
 [admin,author,stranger,pending]=await Promise.all([user(91001,'ADMIN'),user(91002,'LEAD'),user(91003,'TRAINEE'),user(91004,'LEAD',false)]);
 event=(await db.bankEvent.create({data:{authorId:author.id,title:'Synthetic',category:'EDUCATIONAL',tags:[],isPublic:true}})).id;privateEvent=(await db.bankEvent.create({data:{authorId:author.id,title:'Private',category:'EDUCATIONAL',tags:[],isPublic:false}})).id;
},120000);
afterAll(async()=>{if(app)await app.close();if(db)await db.$disconnect();if(pg)await pg.stop();},30000);
it('author still needs file permission, inactive/unauth/foreign private objects are denied',async()=>{
 expect((await upload(author)).statusCode).toBe(403);expect((await upload(stranger)).statusCode).toBe(403);expect((await upload(pending)).statusCode).toBe(403);
 expect((await request(stranger,`/api/bank-events/${privateEvent}/files`)).statusCode).toBe(404);expect((await app.inject({url:base()})).statusCode).toBe(401);
 const shift=await db.shift.create({data:{title:'Synthetic',startDate:new Date('2027-01-01'),endDate:new Date('2027-01-02'),visibility:'ADMIN_LEAD_TRAINEE'}});await db.shiftRole.create({data:{shiftId:shift.id,userId:author.id,position:'Медиа-группа'}});
 expect((await upload(author)).statusCode).toBe(201);
});
it('CLEAN upload/download has minimal DTO, attachment headers, idempotency and audit',async()=>{
 const key=randomUUID();const first=await upload(admin,event,key);expect(first.statusCode).toBe(201);const file=first.json().file;expect(file.scanStatus).toBe('CLEAN');expect(Object.keys(file).sort()).toEqual(['createdAt','fileName','fileSize','fileType','id','mimeType','scanStatus']);
 const second=await upload(admin,event,key);expect(second.json().file.id).toBe(file.id);expect(await db.auditLog.count({where:{entityId:file.id,action:'BANK_FILE_UPLOADED'}})).toBe(1);
 expect((await upload(admin,event,key,'different.txt')).statusCode).toBe(409);
 const download=await request(stranger,`${base()}/${file.id}/download`);expect(download.statusCode).toBe(200);expect(download.body).toBe('Synthetic test');expect(download.headers['content-disposition']).toContain('attachment');expect(download.headers['cache-control']).toBe('no-store');
 expect((await request(admin,`/api/bank-events/${privateEvent}/files/${file.id}/download`)).statusCode).toBe(404);
});
it('PENDING, INFECTED and ERROR cannot download, scanner errors are safe and retry recovers',async()=>{
 for(const state of ['INFECTED','ERROR'] as const){scan=state;const response=await upload();expect(response.statusCode).toBe(201);const id=response.json().file.id;expect(response.json().file.scanStatus).toBe(state);const denied=await request(admin,`${base()}/${id}/download`);expect(denied.statusCode).toBe(409);expect(response.body).not.toContain('secret');
  await db.bankEventFile.update({where:{id},data:{scanStatus:'PENDING'}});expect((await request(admin,`${base()}/${id}/download`)).statusCode).toBe(409);scan='CLEAN';const retry=await request(admin,`${base()}/${id}/scan`,'POST',{});expect(retry.json().file.scanStatus).toBe('CLEAN');
 }
});
it('storage failure never permits download and upload can be repeated with the same key',async()=>{
 storageFailure=true;const key=randomUUID();const failed=await upload(admin,event,key);expect(failed.statusCode).toBe(503);expect(failed.body).not.toContain('secret');const row=await db.bankEventFile.findUniqueOrThrow({where:{requestKey:`${admin.id}:${event}:${key}`}});expect(row.scanStatus).toBe('ERROR');storageFailure=false;expect((await upload(admin,event,key)).json().file.scanStatus).toBe('CLEAN');
});
it('rejects spoofed content/MIME, client scanStatus, and oversized documents',async()=>{
 expect((await upload(admin,event,randomUUID(),'fake.pdf','application/pdf')).statusCode).toBe(400);
 expect((await upload(admin,event,randomUUID(),'script.html','text/html')).statusCode).toBe(400);
 expect((await upload(admin,event,randomUUID(),'text.txt','application/octet-stream')).statusCode).toBe(400);
 expect((await upload(admin,event,randomUUID(),'large.txt','text/plain',Buffer.alloc(20*1024*1024+1,65))).statusCode).toBe(413);
 const clean=await upload();expect((await request(admin,`${base()}/${clean.json().file.id}/scan`,'POST',{scanStatus:'CLEAN'})).statusCode).toBe(400);
});
it('concurrent repeat deletion audits once; storage failure hides file and cleanup retries tombstones and orphans',async()=>{
 const created=await upload();const id=created.json().file.id;deleteFailure=true;
 const result=await Promise.all([request(admin,`${base()}/${id}`,'DELETE',{}),request(admin,`${base()}/${id}`,'DELETE',{})]);expect(result.map(r=>r.statusCode)).toEqual([200,200]);expect(result[0]!.json().cleanupPending).toBe(true);
 expect((await request(admin,`${base()}/${id}/download`)).statusCode).toBe(404);expect(await db.auditLog.count({where:{entityId:id,action:'BANK_FILE_DELETED'}})).toBe(1);
 expect((await request(stranger,`${base()}/${id}`,'DELETE',{})).statusCode).toBe(403);
 objects.set('bank/orphan.txt',Buffer.from('orphan'));deleteFailure=false;const cleaned=await new BankFilesService(db,files).cleanup();expect(cleaned.removed).toBeGreaterThanOrEqual(2);expect(cleaned.failed).toBe(0);expect(objects.has('bank/orphan.txt')).toBe(false);expect((await request(admin,`${base()}/${id}`,'DELETE',{})).json()).toEqual({ok:true,cleanupPending:false});
});
it('upload audit rollback does not leave metadata or an object',async()=>{
 const count=objects.size;const key=randomUUID();await db.$executeRawUnsafe(`CREATE FUNCTION reject_file_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'BANK_FILE_UPLOADED' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$`);await db.$executeRawUnsafe(`CREATE TRIGGER reject_file_audit BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION reject_file_audit()`);
 try{expect((await upload(admin,event,key)).statusCode).toBe(500);expect(await db.bankEventFile.count({where:{requestKey:`${admin.id}:${event}:${key}`}})).toBe(0);expect(objects.size).toBe(count);}finally{await db.$executeRawUnsafe('DROP TRIGGER reject_file_audit ON "AuditLog"');await db.$executeRawUnsafe('DROP FUNCTION reject_file_audit()');}
});
it('private bank list preserves author/admin access and never leaks closed materials to outsiders',async()=>{
 for(const actor of [author,admin]){const res=await request(actor,'/api/bank-events?search=Private');expect(res.statusCode).toBe(200);expect(res.json().items.map((r:{id:string})=>r.id)).toContain(privateEvent);}
 const outsider=await request(stranger,'/api/bank-events?search=Private');expect(outsider.json().items.map((r:{id:string})=>r.id)).not.toContain(privateEvent);
 const created=await upload(admin,privateEvent);expect(created.statusCode).toBe(201);const id=created.json().file.id;
 for(const suffix of ['',`/${id}/download`])expect((await request(stranger,`/api/bank-events/${privateEvent}/files${suffix}`)).statusCode).toBe(404);
 expect((await request(stranger,`${base()}/${id}/download`)).statusCode).toBe(404);
 expect((await request(stranger,`/api/bank-events/${privateEvent}/files/${id}/scan`,'POST',{})).statusCode).toBe(404);
});
it('concurrent identical uploads allocate one object and one upload audit',async()=>{
 const key=randomUUID();scan='CLEAN';const result=await Promise.all([upload(admin,event,key),upload(admin,event,key)]);expect(result.map(r=>r.statusCode)).toEqual([201,201]);expect(result[0]!.json().file.id).toBe(result[1]!.json().file.id);
 expect(await db.auditLog.count({where:{entityId:result[0]!.json().file.id,action:'BANK_FILE_UPLOADED'}})).toBe(1);
});
it('deleting during delayed PUT never resurrects downloads; cleanup removes late objects',async()=>{
 let release!:()=>void,entered!:()=>void;const gate=new Promise<void>(r=>{release=r;});const started=new Promise<void>(r=>{entered=r;});
 const delayed:FileDependencies={...files,storage:{...files.storage,async put(key,bytes,mime){entered();await gate;await files.storage.put(key,bytes,mime);}}};
 const service=new BankFilesService(db,delayed),key=randomUUID();const task=service.upload(admin.id,event,key,'late.txt','text/plain',Buffer.from('Late synthetic'));
 await started;const row=await db.bankEventFile.findUniqueOrThrow({where:{requestKey:`${admin.id}:${event}:${key}`}});
 await service.remove(admin.id,event,row.id);release();await expect(task).rejects.toMatchObject({status:404});
 expect(objects.has(row.storageKey)).toBe(true);await expect(service.download(admin.id,event,row.id)).rejects.toMatchObject({status:404});
 await service.cleanup();expect(objects.has(row.storageKey)).toBe(false);
});
it('checksum mismatch and scanner disconnect fail closed; cleanup preserves live objects',async()=>{
 const uploaded=await upload();const id=uploaded.json().file.id;const row=await db.bankEventFile.findUniqueOrThrow({where:{id}});objects.set(row.storageKey,Buffer.from('tampered'));
 const download=await request(admin,`${base()}/${id}/download`);expect(download.statusCode).toBe(503);expect(download.body).not.toContain('secret');
 await db.bankEventFile.update({where:{id},data:{scanStatus:'PENDING'}});expect((await request(admin,`${base()}/${id}/scan`,'POST',{})).json().file.scanStatus).toBe('ERROR');
 objects.set('bank/failure-orphan.txt',Buffer.from('orphan'));deleteFailure=true;expect((await new BankFilesService(db,files).cleanup()).failed).toBeGreaterThan(0);deleteFailure=false;
 await new BankFilesService(db,files).cleanup();expect(objects.has(row.storageKey)).toBe(true);expect(objects.has('bank/failure-orphan.txt')).toBe(false);
});
// Explicit opt-in against compose.files-test.yml ONLY. This is never counted as
// a real integration PASS when the local services are absent.
it.skipIf(process.env.RUN_FILES_SERVICES!=='1')('real private MinIO and ClamAV: clean, EICAR, 50 MiB stream, download, delete and orphan cleanup',async()=>{
 const real:FileDependencies={storage:new S3FileStorage('komanda-test',{endpoint:'http://127.0.0.1:19000',region:'us-east-1',accessKeyId:'synthetic-test',secretAccessKey:'synthetic-test-only-password'}),scanner:new ClamAvScanner('127.0.0.1',13310)};
 const service=new BankFilesService(db,real);const created:string[]=[];const orphan=`bank/${randomUUID()}.txt`;
 try{
  const clean=await service.upload(admin.id,event,randomUUID(),'real-clean.txt','text/plain',Buffer.from('Synthetic clean file'));created.push(clean.file.id);expect(clean.file.scanStatus).toBe('CLEAN');expect((await service.download(admin.id,event,clean.file.id)).bytes.toString()).toBe('Synthetic clean file');
  const row=await db.bankEventFile.findUniqueOrThrow({where:{id:clean.file.id}});
  const anonymous=await fetch(`http://127.0.0.1:19000/komanda-test/${row.storageKey}`);expect(anonymous.status).toBe(403);
  const eicar=Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'.replace('\\\\','\\'));
  const infected=await service.upload(admin.id,event,randomUUID(),'real-eicar.txt','text/plain',eicar);created.push(infected.file.id);expect(infected.file.scanStatus).toBe('INFECTED');await expect(service.download(admin.id,event,infected.file.id)).rejects.toMatchObject({code:'FILE_NOT_CLEAN'});
  expect(await real.scanner.scan(Buffer.alloc(50*1024*1024,65))).toBe('CLEAN');
  await real.storage.put(orphan,Buffer.from('Synthetic orphan'),'text/plain');expect((await service.cleanup()).failed).toBe(0);await expect(real.storage.get(orphan)).rejects.toThrow();
  for(const id of created){expect(await service.remove(admin.id,event,id)).toEqual({ok:true,cleanupPending:false});expect(await service.remove(admin.id,event,id)).toEqual({ok:true,cleanupPending:false});await expect(service.download(admin.id,event,id)).rejects.toMatchObject({status:404});}
 }finally{for(const id of created)await service.remove(admin.id,event,id);await real.storage.remove(orphan);}
},180000);
it('editing a private bank title cannot reset visibility or tags; hidden direct IDs remain hidden',async()=>{
 await db.bankEvent.update({where:{id:privateEvent},data:{tags:['preserved']}});
 const patch=(actor:User,payload:object)=>app.inject({method:'PATCH',url:`/api/bank-events/${privateEvent}`,headers:{origin,cookie:cookies.get(actor.id)!},payload});
 const result=await patch(author,{title:'Private renamed'});expect(result.statusCode).toBe(200);expect(result.json().event).toMatchObject({isPublic:false,tags:['preserved']});
 expect((await patch(author,{})).statusCode).toBe(400);expect((await patch(stranger,{title:'Forbidden'})).statusCode).toBe(404);
 expect((await request(stranger,`/api/bank-events/${privateEvent}`)).statusCode).toBe(404);
});
