import {beforeAll,afterAll,it,expect} from 'vitest';
import {PrismaClient,type User} from '@prisma/client';
import EmbeddedPostgres from 'embedded-postgres';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:net';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import type {FastifyInstance} from 'fastify';
import {buildApp} from '../src/app.js';
import {hashToken} from '../src/services/auth.js';
import {testWorkbook} from './xlsx-fixture.js';
import {cleanupChildPreviews} from '../src/services/children-import.js';
const origin='http://localhost:5173',headers=['Фамилия','Имя','Дата рождения','Отряд','Корпус','Комната'];
let pg:EmbeddedPostgres,db:PrismaClient,app:FastifyInstance,importer:User,roomer:User,denied:User,shift:string,other:string,a:string,b:string,foreign:string;
const cookies=new Map<string,string>();
const base=()=>`/api/shifts/${shift}/children/import`;
const send=(actor:User,url:string,payload:object)=>app.inject({method:'POST',url,headers:{cookie:cookies.get(actor.id)!,origin},payload});
const preview=(actor:User,rows:(string|number|null)[][])=>app.inject({method:'POST',url:base()+'/preview',headers:{cookie:cookies.get(actor.id)!,origin,'content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},payload:testWorkbook(rows)});
const mapping=(actor:User,jobId:string,memberId:string)=>send(actor,`${base()}/${jobId}/mapping`,{revision:1,choices:[{rowNumber:2,action:'match',memberId}]});
const commit=(actor:User,jobId:string,revision=1)=>send(actor,`${base()}/${jobId}/commit`,{revision,confirmed:true});
beforeAll(async()=>{
 const listener=createServer();await new Promise<void>(r=>listener.listen(0,'127.0.0.1',r));const address=listener.address();if(!address||typeof address==='string')throw Error('port');const port=address.port;await new Promise<void>(r=>listener.close(()=>r()));
 const password=randomBytes(20).toString('hex'),dir=await mkdtemp(join(tmpdir(),'komanda-import-'));
 pg=new EmbeddedPostgres({databaseDir:join(dir,'data'),user:'postgres',password,port,persistent:false,autoRehydrateSymlinks:true,postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{}});
 await pg.initialise();await pg.start();await pg.createDatabase('imports');
 const url=`postgresql://postgres:${password}@127.0.0.1:${port}/imports`;db=new PrismaClient({datasources:{db:{url}}});
 execFileSync(process.execPath,[resolve('../node_modules/prisma/build/index.js'),'migrate','deploy','--schema',resolve('prisma/schema.prisma')],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
 app=await buildApp({NODE_ENV:'test',HOST:'127.0.0.1',PORT:3001,DATABASE_URL:url,APP_ORIGIN:origin,TELEGRAM_BOT_TOKEN:'123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijk'},db);
 async function actor(n:number,role:User['role']){const user=await db.user.create({data:{telegramId:BigInt(n),firstName:'Synthetic',role,isOnboarded:true,accountStatus:'CONFIRMED'}});const token=randomBytes(32).toString('base64url');await db.session.create({data:{userId:user.id,tokenHash:hashToken(token),expiresAt:new Date(Date.now()+3600000)}});cookies.set(user.id,`komanda_session=${token}`);return user;}
 [importer,roomer,denied]=await Promise.all([actor(802,'LEAD'),actor(803,'LEAD'),actor(804,'LEAD')]);
 const data={title:'Synthetic',visibility:'ADMIN_LEAD_TRAINEE' as const,startDate:new Date('2027-01-01'),endDate:new Date('2027-01-10')};shift=(await db.shift.create({data})).id;other=(await db.shift.create({data})).id;
 a=(await db.squad.create({data:{shiftId:shift,name:'A'}})).id;b=(await db.squad.create({data:{shiftId:shift,name:'B'}})).id;foreign=(await db.squad.create({data:{shiftId:other,name:'Foreign'}})).id;
 await db.shiftRole.createMany({data:[{userId:importer.id,shiftId:shift,position:'Ответственный за столовую'},{userId:roomer.id,shiftId:shift,position:'Ответственный за расселение'}]});
 await app.listen({host:'127.0.0.1',port:0});
},120000);
afterAll(async()=>{if(app)await app.close();if(db)await db.$disconnect();if(pg)await pg.stop();},30000);
it('accepts XLSX upload over a real HTTP connection', async () => {
  const address = app.server.address();
  if (!address || typeof address === 'string') {
    throw Error('HTTP server address unavailable');
  }

  const response = await fetch(
    `http://127.0.0.1:${address.port}${base()}/preview`,
    {
      method:'POST',
      headers:{
        cookie:cookies.get(importer.id)!,
        origin,
        'content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      body:testWorkbook([
        headers,
        ['Http','Upload','2015-01-02','A'],
      ]),
    },
  );

  expect(response.status).toBe(201);

  const result = await response.json() as {jobId:string};
  expect(result.jobId).toBeTruthy();
}, 30000);
it('requires import permission and actor/job ownership and explicit confirmation',async()=>{
 expect((await preview(denied,[headers,['X','Y','2015-01-02','A']])).statusCode).toBe(403);
 const job=(await preview(importer,[headers,['Access','Test','2015-01-02','A']])).json();expect((await commit(roomer,job.jobId)).statusCode).toBe(404);
 expect((await send(importer,`${base()}/${job.jobId}/commit`,{revision:1,confirmed:false})).statusCode).toBe(400);
});
it('partially creates, strips PII, repeats safely, requires single-candidate mapping, preserves blank placement and avoids UPDATE',async()=>{
 const response=await preview(importer,[headers,['Unique','Child','2015-01-02','A','B','12'],['Invalid','Child','01.02.15','A'],['Unknown','Child','2015-01-02','Foreign']]);expect(response.statusCode).toBe(201);const job=response.json();
 const done=await commit(importer,job.jobId);expect(done.statusCode).toBe(200);expect(done.json().result.counts).toEqual({CREATED:1,SKIPPED:2});const id=done.json().result.rows[0].memberId;
 const saved=await db.importJob.findUniqueOrThrow({where:{id:job.jobId}});for(const secret of ['Unique','2015-01-02','building','room','squadId'])expect(JSON.stringify(saved.preview)).not.toContain(secret);
 expect((await commit(importer,job.jobId)).json()).toEqual(done.json());
 const before=await db.squadMember.findUniqueOrThrow({where:{id}});
 const repeat=(await preview(importer,[headers,[' UNIQUE ','child','2015-01-02','A','','']])).json();expect(repeat.rows[0].category).toBe('UNRESOLVED');expect(repeat.rows[0].candidates).toHaveLength(1);
 const mapped=await mapping(importer,repeat.jobId,id);expect(mapped.statusCode).toBe(200);expect(mapped.json().rows[0].category).toBe('UNCHANGED');expect((await commit(importer,repeat.jobId,2)).json().result.noChanges).toBe(true);
 const after=await db.squadMember.findUniqueOrThrow({where:{id}});expect(after.updatedAt).toEqual(before.updatedAt);expect(after.building).toBe('B');expect(after.room).toBe('12');
 const update=(await preview(importer,[headers,['Unique','Child','2015-01-02','B','C','13']])).json();expect((await mapping(importer,update.jobId,id)).json().rows[0].category).toBe('FORBIDDEN');expect((await commit(importer,update.jobId,2)).json().result.counts).toEqual({SKIPPED:1});
});
it('preserves missing optional columns, permits placement with edit_room, manual clears only, rejects IDOR and identity changes',async()=>{
 const child=await db.squadMember.create({data:{shiftId:shift,squadId:a,memberType:'CHILD',firstName:'Placement',lastName:'Test',birthDate:new Date('2015-01-02'),building:'Keep',room:'KeepRoom'}});
 const job=(await preview(roomer,[headers.slice(0,4),['Test','Placement','2015-01-02','B']])).json();const mapped=(await mapping(roomer,job.jobId,child.id)).json();expect(mapped.rows[0].changes).toEqual({squadId:{before:a,after:b}});expect((await commit(roomer,job.jobId,2)).json().result.counts).toEqual({UPDATED:1});
 const current=await db.squadMember.findUniqueOrThrow({where:{id:child.id}});expect(current.building).toBe('Keep');expect(current.room).toBe('KeepRoom');expect(current.firstName).toBe('Placement');
 const patch=(actor:User,payload:object)=>app.inject({method:'PATCH',url:`/api/shifts/${shift}/squads/${b}/children/${child.id}`,headers:{cookie:cookies.get(actor.id)!,origin},payload});
 expect((await patch(importer,{room:null})).statusCode).toBe(403);expect((await patch(roomer,{birthDate:'2014-01-01'})).statusCode).toBe(400);expect((await patch(roomer,{firstName:'Changed'})).statusCode).toBe(400);expect((await patch(roomer,{squadId:foreign})).statusCode).toBe(404);expect((await patch(roomer,{building:null,room:null})).statusCode).toBe(200);
 const cleared=await db.squadMember.findUniqueOrThrow({where:{id:child.id}});expect(cleared.room).toBeNull();expect(cleared.building).toBeNull();await expect(db.squad.delete({where:{id:b}})).rejects.toThrow(/RESTRICT|foreign key/i);expect(await db.squad.count({where:{id:b}})).toBe(1);expect(await db.squadMember.count({where:{id:child.id}})).toBe(1);
});
it('keeps ambiguity unresolved, never matches across shifts or different DOB, rejects conflicting rows',async()=>{
 const data={shiftId:shift,squadId:a,memberType:'CHILD' as const,firstName:'Ambiguous',lastName:'Test',birthDate:new Date('2015-01-02')};const one=await db.squadMember.create({data});await db.squadMember.create({data:{...data,squadId:b}});await db.squadMember.create({data:{...data,shiftId:other,squadId:foreign}});
 const job=(await preview(roomer,[headers,['Test','Ambiguous','2015-01-02','A']])).json();expect(job.rows[0].candidates).toHaveLength(2);expect((await commit(roomer,job.jobId)).json().result.counts).toEqual({SKIPPED:1});
 const different=(await preview(roomer,[headers,['Test','Ambiguous','2014-01-02','A']])).json();expect(different.rows[0].candidates).toHaveLength(0);expect(different.rows[0].warnings).toContain('IDENTITY_REQUIRES_ATTENTION');expect((await mapping(roomer,different.jobId,one.id)).json().rows[0].errors).toContain('INVALID_CANDIDATE');
 const independent = (await preview(roomer, [
  headers,
  ['Test', 'Ambiguous', '2014-01-02', 'A']
])).json();

expect(independent.rows[0].category).toBe('NEW');
expect(independent.rows[0].warnings).toContain('IDENTITY_REQUIRES_ATTENTION');

const independentCommit = await commit(roomer, independent.jobId);

expect(independentCommit.statusCode).toBe(200);
expect(independentCommit.json().result.counts).toEqual({ CREATED: 1 });

const separatelyCreated = await db.squadMember.findFirstOrThrow({
  where: {
    shiftId: shift,
    firstName: 'Ambiguous',
    lastName: 'Test',
    birthDate: new Date('2014-01-02')
  }
});

expect(separatelyCreated.id).not.toBe(one.id);
 const dup=(await preview(importer,[headers,['Duplicate','Test','2015-01-02','A'],['Duplicate','Test','2015-01-02','B']])).json();expect(dup.rows.every((r:{errors:string[]})=>r.errors.includes('DUPLICATE_OR_CONFLICTING_ROWS'))).toBe(true);
});
it('serializes same-job and cross-job commit, skips stale snapshot, rejects expiry and cleans preview',async()=>{
 const input=[headers,['Concurrent','Test','2015-01-02','A']];const j1=(await preview(importer,input)).json(),j2=(await preview(importer,input)).json();const results=await Promise.all([commit(importer,j1.jobId),commit(importer,j1.jobId),commit(importer,j2.jobId)]);expect(results.every(r=>r.statusCode===200)).toBe(true);expect(await db.squadMember.count({where:{shiftId:shift,lastName:'Concurrent'}})).toBe(1);
 const member=await db.squadMember.findFirstOrThrow({where:{shiftId:shift,lastName:'Concurrent'}});const stale=(await preview(roomer,[headers,['Concurrent','Test','2015-01-02','A','New','123']])).json();await mapping(roomer,stale.jobId,member.id);await db.squadMember.update({where:{id:member.id},data:{room:'UnseenChange'}});expect((await commit(roomer,stale.jobId,2)).json().result.rows[0].reasons).toContain('DATA_CHANGED');
 const expired=(await preview(importer,[headers,['Expired','Test','2015-01-02','A']])).json();await db.importJob.update({where:{id:expired.jobId},data:{expiresAt:new Date(Date.now()-1000)}});expect((await commit(importer,expired.jobId)).statusCode).toBe(410);await cleanupChildPreviews(db);const cleaned=await db.importJob.findUniqueOrThrow({where:{id:expired.jobId}});expect(cleaned.status).toBe('EXPIRED');expect(cleaned.preview).toEqual({reason:'PREVIEW_EXPIRED'});
});
