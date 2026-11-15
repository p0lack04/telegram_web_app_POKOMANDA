import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {PrismaClient,type User} from '@prisma/client';
import EmbeddedPostgres from 'embedded-postgres';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:net';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import type {FastifyInstance} from 'fastify';
import {buildApp} from '../src/app.js';
import {hashToken} from '../src/services/auth.js';
const origin='http://localhost:5173';
let pg:EmbeddedPostgres,db:PrismaClient,app:FastifyInstance;
let admin:User,lead:User,trainee:User,deputy:User,other:User,pending:User;
let shiftId:string,hiddenId:string;
const cookies=new Map<string,string>();
const headers=(user:User)=>({cookie:cookies.get(user.id)!,origin});
const get=(user:User,url:string)=>app.inject({url,headers:headers(user)});
const post=(user:User,url:string,payload:object)=>app.inject({method:'POST',url,headers:headers(user),payload});
const patch=(user:User,url:string,payload:object)=>app.inject({method:'PATCH',url,headers:headers(user),payload});
const remove=(user:User,url:string)=>app.inject({method:'DELETE',url,headers:headers(user),payload:{}});
let detachUserId=300;
async function detachFixture(position='Ведущий отряда') {
 const user=await fixture(++detachUserId,'LEAD');
 const shift=await db.shift.create({data:{title:'Detach regression',startDate:new Date('2027-01-01'),endDate:new Date('2027-01-10'),visibility:'ADMIN_LEAD_TRAINEE'}});
 const a=await db.squad.create({data:{shiftId:shift.id,name:'A'}});
 const b=await db.squad.create({data:{shiftId:shift.id,name:'B'}});
 await db.application.create({data:{shiftId:shift.id,userId:user.id,type:'LEAD_RECRUIT',status:'APPROVED'}});
 const member=await db.squadMember.create({data:{shiftId:shift.id,squadId:a.id,userId:user.id,memberType:'LEAD',firstName:'Тест',lastName:'Отвязка'}});
 const role=await db.shiftRole.create({data:{shiftId:shift.id,userId:user.id,position,squadId:a.id}});
 const base=`/api/shifts/${shift.id}`;
 return {user,shift,a,b,member,role,base,detach:`${base}/roles/${role.id}/squad`};
}
async function fixture(id:number,role:User['role'],confirmed=true) {
 const user=await db.user.create({data:{telegramId:BigInt(id),firstName:'Тест',lastName:`Сотрудник${id}`,role,isOnboarded:true,accountStatus:confirmed?'CONFIRMED':'PENDING'}});
 const token=randomBytes(32).toString('base64url');await db.session.create({data:{userId:user.id,tokenHash:hashToken(token),expiresAt:new Date(Date.now()+3600000)}});cookies.set(user.id,`komanda_session=${token}`);return user;
}
beforeAll(async()=>{
 const listener=createServer();await new Promise<void>(r=>listener.listen(0,'127.0.0.1',r));const address=listener.address();if(!address||typeof address==='string')throw Error('port');const port=address.port;await new Promise<void>(r=>listener.close(()=>r()));
 const password=randomBytes(20).toString('hex');const dir=await mkdtemp(join(tmpdir(),'komanda-staffing-'));
 pg=new EmbeddedPostgres({databaseDir:join(dir,'data'),user:'postgres',password,port,persistent:false,autoRehydrateSymlinks:true,postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{}});
 await pg.initialise();await pg.start();await pg.createDatabase('staffing');
 const url=`postgresql://postgres:${password}@127.0.0.1:${port}/staffing`;
 db=new PrismaClient({datasources:{db:{url}}});
 // Проверяем upgrade с существующими foundation-данными, не только пустую БД.
 const sql=await readFile(resolve('prisma/migrations/202611110001_foundation/migration.sql'),'utf8');
 const client=pg.getPgClient('staffing');await client.connect();await client.query(sql);await client.end();
 await db.$executeRaw`INSERT INTO "User" (id,"telegramId","firstName","updatedAt") VALUES ('legacy-user',777,'Legacy',NOW())`;
 await db.$executeRaw`INSERT INTO "Shift" (id,title,"startDate","endDate","updatedAt") VALUES ('legacy-shift','Legacy','2027-01-01','2027-01-10',NOW())`;
 await db.$executeRaw`INSERT INTO "Application" (id,"shiftId","userId",type,"updatedAt") VALUES ('legacy-application','legacy-shift','legacy-user','TRAINEE_RECRUIT',NOW())`;
 execFileSync(process.execPath,[resolve('../node_modules/prisma/build/index.js'),'migrate','resolve','--applied','202611110001_foundation','--schema',resolve('prisma/schema.prisma')],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
 execFileSync(process.execPath,[resolve('../node_modules/prisma/build/index.js'),'migrate','deploy','--schema',resolve('prisma/schema.prisma')],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
 app=await buildApp({NODE_ENV:'test',HOST:'127.0.0.1',PORT:3001,DATABASE_URL:url,APP_ORIGIN:origin,TELEGRAM_BOT_TOKEN:'123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijk'},db);
 admin=await fixture(201,'ADMIN');lead=await fixture(202,'LEAD');trainee=await fixture(203,'TRAINEE');deputy=await fixture(204,'LEAD');other=await fixture(205,'TRAINEE');pending=await fixture(206,'TRAINEE',false);
 shiftId=(await db.shift.create({data:{title:'Набор',startDate:new Date('2027-01-01'),endDate:new Date('2027-01-10'),visibility:'ADMIN_LEAD_TRAINEE'}})).id;
 hiddenId=(await db.shift.create({data:{title:'Скрытая',startDate:new Date('2027-01-01'),endDate:new Date('2027-01-10')}})).id;
},120000);
afterAll(async()=>{if(app)await app.close();if(db)await db.$disconnect();if(pg)await pg.stop();},30000);

describe('Stage 3Б: explicit detach regressions',()=>{
 it('Руководителя отвязывает только ADMIN, включая повторный no-op',async()=>{
  const f=await detachFixture('Руководитель');
  await db.shiftRole.create({data:{shiftId:f.shift.id,userId:deputy.id,position:'Заместитель руководителя'}});
  for(const actor of [deputy,f.user,trainee,pending])expect((await patch(actor,f.detach,{squadId:null})).statusCode).toBe(403);
  expect((await db.shiftRole.findUniqueOrThrow({where:{id:f.role.id}})).squadId).toBe(f.a.id);
  expect((await patch(admin,f.detach,{squadId:null})).statusCode).toBe(200);
  expect((await patch(deputy,f.detach,{squadId:null})).statusCode).toBe(403);
  expect((await patch(admin,f.detach,{squadId:null})).statusCode).toBe(200);
  expect(await db.auditLog.count({where:{entityId:f.role.id,action:'POSITION_SQUAD_DETACHED'}})).toBe(1);
  expect(await db.notification.count({where:{userId:f.user.id,shiftId:f.shift.id}})).toBe(1);
 });
 it('несколько должностей и членств сохраняются; оставшаяся привязка блокирует перевод',async()=>{
  const f=await detachFixture();
  const second=await db.shiftRole.create({data:{shiftId:f.shift.id,userId:f.user.id,position:'Стажёр',squadId:f.a.id}});
  await db.squadMember.create({data:{shiftId:f.shift.id,squadId:f.b.id,userId:f.user.id,memberType:'LEAD',firstName:'Тест',lastName:'Отвязка'}});
  const memberships=await db.squadMember.findMany({where:{userId:f.user.id},orderBy:{id:'asc'}});
  expect((await patch(admin,f.detach,{squadId:null})).statusCode).toBe(200);
  expect(await db.squadMember.findMany({where:{userId:f.user.id},orderBy:{id:'asc'}})).toEqual(memberships);
  expect(await db.shiftRole.findUnique({where:{id:second.id}})).toEqual(second);
  expect((await patch(admin,`${f.base}/squad-members/${f.member.id}`,{squadId:f.b.id})).statusCode).toBe(409);
  expect((await remove(admin,`${f.base}/squad-members/${f.member.id}`)).statusCode).toBe(409);
  expect((await patch(admin,`${f.base}/roles/${second.id}/squad`,{squadId:null})).statusCode).toBe(200);
  expect((await remove(admin,`${f.base}/squad-members/${f.member.id}`)).statusCode).toBe(200);
  expect(await db.shiftRole.count({where:{userId:f.user.id}})).toBe(2);
 });
 it('сохраняет position, admission, global role и права; scope перечитывается в той же сессии',async()=>{
  const f=await detachFixture();
  const admission=await db.application.findFirstOrThrow({where:{userId:f.user.id}});
  expect((await get(f.user,`${f.base}/squads/${f.a.id}`)).statusCode).toBe(200);
  expect((await patch(admin,f.detach,{squadId:null})).statusCode).toBe(200);
  expect(await db.shiftRole.findUnique({where:{id:f.role.id}})).toEqual({...f.role,squadId:null});
  expect(await db.user.findUnique({where:{id:f.user.id}})).toEqual(f.user);
  expect(await db.application.findUnique({where:{id:admission.id}})).toEqual(admission);
  // Membership по-прежнему предоставляет scope; position по-прежнему даёт squad.manage.
  expect((await get(f.user,`${f.base}/squads/${f.a.id}`)).statusCode).toBe(200);
  expect((await patch(f.user,`${f.base}/squads/${f.a.id}`,{name:'Сохранено право управления'})).statusCode).toBe(200);
  expect((await patch(admin,`${f.base}/squad-members/${f.member.id}`,{squadId:f.b.id})).statusCode).toBe(200);
  expect((await get(f.user,`${f.base}/squads/${f.a.id}`)).statusCode).toBe(404);
  expect((await get(f.user,`${f.base}/squads/${f.b.id}`)).statusCode).toBe(200);
  expect((await get(f.user,`${f.base}/squads`)).json().items.map((s:{id:string})=>s.id)).toEqual([f.b.id]);
 });
 it('чужая смена, скрытая смена и неизвестное назначение не изменяют роль',async()=>{
  const f=await detachFixture();const otherFixture=await detachFixture();
  expect((await patch(admin,`${otherFixture.base}/roles/${f.role.id}/squad`,{squadId:null})).statusCode).toBe(404);
  expect((await patch(admin,`${f.base}/roles/missing/squad`,{squadId:null})).statusCode).toBe(404);
  await db.shiftRole.create({data:{shiftId:f.shift.id,userId:deputy.id,position:'Заместитель руководителя'}});
  expect((await patch(deputy,otherFixture.detach,{squadId:null})).statusCode).toBe(403);
  await db.shift.update({where:{id:f.shift.id},data:{visibility:'ADMIN_ONLY'}});
  expect((await patch(deputy,f.detach,{squadId:null})).statusCode).toBe(404);
  expect(await db.shiftRole.findUnique({where:{id:f.role.id}})).toEqual(f.role);
  expect(await db.shiftRole.findUnique({where:{id:otherFixture.role.id}})).toEqual(otherFixture.role);
  expect(await db.auditLog.count({where:{shiftId:{in:[f.shift.id,otherFixture.shift.id]}}})).toBe(0);
 });
 it('две параллельные отвязки дают один audit и одно уведомление',async()=>{
  const f=await detachFixture();
  const results=await Promise.all([patch(admin,f.detach,{squadId:null}),patch(admin,f.detach,{squadId:null})]);
  expect(results.map(r=>r.statusCode)).toEqual([200,200]);
  expect((await db.shiftRole.findUniqueOrThrow({where:{id:f.role.id}})).squadId).toBeNull();
  expect(await db.auditLog.count({where:{entityId:f.role.id}})).toBe(1);
  expect(await db.notification.count({where:{userId:f.user.id,shiftId:f.shift.id}})).toBe(1);
 });
 it('конкурирующие перевод и отвязка сохраняют согласованное состояние',async()=>{
  const f=await detachFixture();
  const [move,detach]=await Promise.all([patch(admin,`${f.base}/squad-members/${f.member.id}`,{squadId:f.b.id}),patch(admin,f.detach,{squadId:null})]);
  expect(detach.statusCode).toBe(200);expect([200,409]).toContain(move.statusCode);
  expect((await db.shiftRole.findUniqueOrThrow({where:{id:f.role.id}})).squadId).toBeNull();
  expect((await db.squadMember.findUniqueOrThrow({where:{id:f.member.id}})).squadId).toBe(move.statusCode===200?f.b.id:f.a.id);
  if(move.statusCode===409)expect((await patch(admin,`${f.base}/squad-members/${f.member.id}`,{squadId:f.b.id})).statusCode).toBe(200);
 });
 it('ошибка записи notification откатывает отвязку и уже записанный audit',async()=>{
  const f=await detachFixture();
  await db.$executeRawUnsafe(`CREATE FUNCTION reject_detach_notification() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test notification failure'; END $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER reject_detach_notification BEFORE INSERT ON "Notification" FOR EACH ROW EXECUTE FUNCTION reject_detach_notification()`);
  try {
   expect((await patch(admin,f.detach,{squadId:null})).statusCode).toBe(500);
   expect(await db.shiftRole.findUnique({where:{id:f.role.id}})).toEqual(f.role);
   expect(await db.squadMember.findUnique({where:{id:f.member.id}})).toEqual(f.member);
   expect(await db.auditLog.count({where:{entityId:f.role.id}})).toBe(0);
   expect(await db.notification.count({where:{userId:f.user.id}})).toBe(0);
  } finally {
   await db.$executeRawUnsafe(`DROP TRIGGER reject_detach_notification ON "Notification"`);
   await db.$executeRawUnsafe(`DROP FUNCTION reject_detach_notification()`);
  }
  expect((await patch(admin,f.detach,{squadId:null})).statusCode).toBe(200);
 });
});

describe('staffing HTTP + PostgreSQL',()=>{
 it('миграция сохранила существующие заявки и дала version=0',async()=>{const row=await db.application.findUniqueOrThrow({where:{id:'legacy-application'}});expect(row.version).toBe(0);expect(row.status).toBe('PENDING');});
 it('закрытый набор не принимает заявку',async()=>expect((await post(lead,`/api/shifts/${shiftId}/applications`,{type:'LEAD_RECRUIT'})).statusCode).toBe(409));
 it('набором управляет только ADMIN',async()=>{expect((await patch(lead,`/api/shifts/${shiftId}/recruitment`,{leadRecruitOpen:true})).statusCode).toBe(403);expect((await patch(admin,`/api/shifts/${shiftId}/recruitment`,{leadRecruitOpen:true,traineeRecruitOpen:true,stage:'STAGE_2'})).statusCode).toBe(200);});
 it('валидация identity/type/pending и hidden shift',async()=>{
  expect((await post(pending,`/api/shifts/${shiftId}/applications`,{type:'TRAINEE_RECRUIT'})).statusCode).toBe(403);
  expect((await post(trainee,`/api/shifts/${shiftId}/applications`,{type:'LEAD_RECRUIT'})).statusCode).toBe(400);
  expect((await post(trainee,`/api/shifts/${shiftId}/applications`,{type:'TRAINEE_RECRUIT',userId:lead.id})).statusCode).toBe(400);
  expect((await post(lead,`/api/shifts/${hiddenId}/applications`,{type:'LEAD_RECRUIT'})).statusCode).toBe(404);
 });
 it('параллельная подача создаёт ровно одну заявку',async()=>{const results=await Promise.all([post(lead,`/api/shifts/${shiftId}/applications`,{type:'LEAD_RECRUIT'}),post(lead,`/api/shifts/${shiftId}/applications`,{type:'LEAD_RECRUIT'})]);expect(results.map(r=>r.statusCode).sort()).toEqual([201,409]);expect(await db.application.count({where:{shiftId,userId:lead.id}})).toBe(1);});
 it('trainee подаёт заявку, но не видит чужую',async()=>{expect((await post(trainee,`/api/shifts/${shiftId}/applications`,{type:'TRAINEE_RECRUIT'})).statusCode).toBe(201);const response=await get(trainee,`/api/shifts/${shiftId}/applications`);expect(response.json().total).toBe(1);expect(response.json().items[0].userId).toBe(trainee.id);expect(response.json().items[0].user).not.toHaveProperty('phone');expect((await get(admin,`/api/shifts/${shiftId}/applications`)).json().total).toBe(2);});
 it('не ADMIN не принимает чужую заявку',async()=>{const application=await db.application.findFirstOrThrow({where:{userId:lead.id,shiftId}});expect((await patch(trainee,`/api/applications/${application.id}`,{status:'APPROVED',version:0})).statusCode).toBe(403);});
 it('параллельные решения фиксируют только одно и одну notification',async()=>{const application=await db.application.findFirstOrThrow({where:{userId:lead.id,shiftId}});const results=await Promise.all([patch(admin,`/api/applications/${application.id}`,{status:'APPROVED',version:0}),patch(admin,`/api/applications/${application.id}`,{status:'APPROVED',version:0})]);expect(results.map(r=>r.statusCode).sort()).toEqual([200,409]);expect(await db.notification.count({where:{userId:lead.id}})).toBe(1);expect(await db.auditLog.count({where:{entityId:application.id,action:'APPLICATION_APPROVED'}})).toBe(1);expect(await db.shiftRole.count({where:{userId:lead.id}})).toBe(0);});
 it('отклонение сохраняется, не допускает пересмотр/новую заявку',async()=>{const application=await db.application.findFirstOrThrow({where:{userId:trainee.id,shiftId}});expect((await patch(admin,`/api/applications/${application.id}`,{status:'REJECTED',version:0})).statusCode).toBe(200);expect((await patch(admin,`/api/applications/${application.id}`,{status:'APPROVED',version:1})).statusCode).toBe(409);expect((await post(trainee,`/api/shifts/${shiftId}/applications`,{type:'TRAINEE_RECRUIT'})).statusCode).toBe(409);expect((await post(admin,`/api/shifts/${shiftId}/staff`,{userId:trainee.id})).statusCode).toBe(409);});
 it('закрытие набора не мешает рассмотреть уже отправленную заявку',async()=>{expect((await post(other,`/api/shifts/${shiftId}/applications`,{type:'TRAINEE_RECRUIT'})).statusCode).toBe(201);await patch(admin,`/api/shifts/${shiftId}/recruitment`,{traineeRecruitOpen:false});const application=await db.application.findFirstOrThrow({where:{userId:other.id,shiftId}});expect((await patch(admin,`/api/applications/${application.id}`,{status:'APPROVED',version:0})).statusCode).toBe(200);});
 it('нельзя назначать непринятого/неизвестную должность/чужой отряд',async()=>{
  expect((await post(admin,`/api/shifts/${shiftId}/roles`,{userId:trainee.id,position:'Стажёр'})).statusCode).toBe(409);
  expect((await post(admin,`/api/shifts/${shiftId}/roles`,{userId:lead.id,position:'__proto__'})).statusCode).toBe(400);
  const squad=await db.squad.create({data:{shiftId:hiddenId,name:'Скрытый отряд'}});
  expect((await post(admin,`/api/shifts/${shiftId}/roles`,{userId:lead.id,position:'Ведущий отряда',squadId:squad.id})).statusCode).toBe(409);
 });
 it('ручное добавление ADMIN создаёт admission, не меняя глобальную роль',async()=>{expect((await post(lead,`/api/shifts/${shiftId}/staff`,{userId:deputy.id})).statusCode).toBe(403);expect((await post(admin,`/api/shifts/${shiftId}/staff`,{userId:pending.id})).statusCode).toBe(409);expect((await post(admin,`/api/shifts/${shiftId}/staff`,{userId:deputy.id})).statusCode).toBe(201);expect((await db.user.findUniqueOrThrow({where:{id:deputy.id}})).role).toBe('LEAD');});
 it('ADMIN назначает несколько должностей, duplicate→409',async()=>{expect((await post(admin,`/api/shifts/${shiftId}/roles`,{userId:lead.id,position:'Медиа-группа'})).statusCode).toBe(201);expect((await post(admin,`/api/shifts/${shiftId}/roles`,{userId:lead.id,position:'Ответственный за программу'})).statusCode).toBe(201);expect((await post(admin,`/api/shifts/${shiftId}/roles`,{userId:lead.id,position:'Медиа-группа'})).statusCode).toBe(409);expect((await get(lead,'/api/me/assignments')).json().total).toBe(2);});
 it('заместитель управляет должностями только своей смены и не руководителем',async()=>{
  expect((await post(admin,`/api/shifts/${shiftId}/roles`,{userId:deputy.id,position:'Заместитель руководителя'})).statusCode).toBe(201);
  expect((await post(deputy,`/api/shifts/${shiftId}/roles`,{userId:lead.id,position:'Хореограф'})).statusCode).toBe(201);
  expect((await post(deputy,`/api/shifts/${shiftId}/roles`,{userId:lead.id,position:'Руководитель'})).statusCode).toBe(403);
  const leader=await post(admin,`/api/shifts/${shiftId}/roles`,{userId:lead.id,position:'Руководитель'});expect(leader.statusCode).toBe(201);
  expect((await remove(deputy,`/api/shifts/${shiftId}/roles/${leader.json().assignment.id}`)).statusCode).toBe(403);
  expect((await post(deputy,`/api/shifts/${hiddenId}/roles`,{userId:lead.id,position:'Хореограф'})).statusCode).toBe(404);
 });
 it('состав только менеджерам, own roles остальным, DTO минимален',async()=>{expect((await get(trainee,`/api/shifts/${shiftId}/staff`)).statusCode).toBe(403);const roster=await get(deputy,`/api/shifts/${shiftId}/staff`);expect(roster.statusCode).toBe(200);expect(roster.json().items[0]).not.toHaveProperty('phone');expect(roster.json().items[0]).not.toHaveProperty('birthDate');expect((await get(other,`/api/shifts/${shiftId}/roles`)).json().total).toBe(0);});
 it('явная отвязка сохраняет должность и блокирует нарушение связи',async()=>{const a=await db.squad.create({data:{shiftId:shiftId,name:'Detach A'}});const b=await db.squad.create({data:{shiftId:shiftId,name:'Detach B'}});const member=await db.squadMember.create({data:{shiftId:shiftId,squadId:a.id,userId:lead.id,memberType:'LEAD',firstName:lead.firstName,lastName:lead.lastName??''}});const role=await db.shiftRole.create({data:{shiftId:shiftId,userId:lead.id,position:'Ответственный за столовую',squadId:a.id}});expect((await patch(trainee,`/api/shifts/${shiftId}/roles/${role.id}/squad`,{squadId:null})).statusCode).toBe(403);expect((await patch(deputy,`/api/shifts/${shiftId}/roles/${role.id}/squad`,{squadId:'wrong'})).statusCode).toBe(400);expect((await patch(deputy,`/api/shifts/${shiftId}/roles/${role.id}/squad`,{squadId:null})).statusCode).toBe(200);const detached=await db.shiftRole.findUniqueOrThrow({where:{id:role.id}});expect(detached.squadId).toBeNull();expect(detached.position).toBe('Ответственный за столовую');expect((await patch(deputy,`/api/shifts/${shiftId}/roles/${role.id}/squad`,{squadId:null})).statusCode).toBe(200);expect(await db.auditLog.count({where:{entityId:role.id,action:'POSITION_SQUAD_DETACHED'}})).toBe(1);await db.shiftRole.update({where:{id:role.id},data:{squadId:a.id}});expect((await patch(deputy,`/api/shifts/${shiftId}/squad-members/${member.id}`,{squadId:b.id})).statusCode).toBe(409);await patch(deputy,`/api/shifts/${shiftId}/roles/${role.id}/squad`,{squadId:null});expect((await patch(deputy,`/api/shifts/${shiftId}/squad-members/${member.id}`,{squadId:b.id})).statusCode).toBe(200);expect((await app.inject({method:'DELETE',url:`/api/shifts/${shiftId}/squad-members/${member.id}`,headers:headers(deputy),payload:{}})).statusCode).toBe(200);});
 it('снятие назначения scoped и аудит сохраняется после удаления',async()=>{const role=await db.shiftRole.findFirstOrThrow({where:{userId:lead.id,position:'Медиа-группа'}});expect((await remove(other,`/api/shifts/${shiftId}/roles/${role.id}`)).statusCode).toBe(403);expect((await remove(admin,`/api/shifts/${hiddenId}/roles/${role.id}`)).statusCode).toBe(404);expect((await remove(admin,`/api/shifts/${shiftId}/roles/${role.id}`)).statusCode).toBe(204);expect(await db.auditLog.count({where:{entityId:role.id,action:'POSITION_REMOVED'}})).toBe(1);});
 it('история staff ограничена своим subject, заместитель не читает решения по анкетам',async()=>{const own=(await get(trainee,`/api/shifts/${shiftId}/staffing-history`)).json();expect(own.total).toBe(2);expect(own.items.every((v:{details:{subjectUserId:string}})=>v.details.subjectUserId===trainee.id)).toBe(true);const manager=(await get(deputy,`/api/shifts/${shiftId}/staffing-history`)).json();expect(manager.items.every((v:{action:string})=>v.action.startsWith('POSITION_'))).toBe(true);});
 it('уведомление прочитать может только получатель',async()=>{const inbox=(await get(trainee,'/api/me/notifications')).json();expect(inbox.total).toBe(1);const id=inbox.items[0].id;expect((await post(lead,`/api/me/notifications/${id}/read`,{})).statusCode).toBe(404);expect((await post(trainee,`/api/me/notifications/${id}/read`,{})).json().notification.readAt).toBeTruthy();});
 it('уведомления соблюдают текущую видимость в inbox и mark-read',async()=>{
  const s=await db.shift.create({data:{title:'Временный доступ',startDate:new Date('2027-02-01'),endDate:new Date('2027-02-10'),visibility:'ADMIN_LEAD_TRAINEE'}});
  const notification=await db.notification.create({data:{userId:other.id,shiftId:s.id,kind:'STAFFING',text:'Секрет смены'}});
  await db.shift.update({where:{id:s.id},data:{visibility:'ADMIN_ONLY'}});
  const inbox=await get(other,'/api/me/notifications');expect(inbox.body).not.toContain('Секрет смены');expect(inbox.json().items.map((n:{id:string})=>n.id)).not.toContain(notification.id);
  expect((await post(other,`/api/me/notifications/${notification.id}/read`,{})).statusCode).toBe(404);
 });
 it('новое решение по скрытой смене не раскрывается уведомлением',async()=>{
  const s=await db.shift.create({data:{title:'Не раскрывать название',startDate:new Date('2027-02-01'),endDate:new Date('2027-02-10'),visibility:'ADMIN_LEAD_TRAINEE'}});
  const a=await db.application.create({data:{shiftId:s.id,userId:other.id,type:'TRAINEE_RECRUIT'}});
  await db.shift.update({where:{id:s.id},data:{visibility:'ADMIN_ONLY'}});
  expect((await patch(admin,`/api/applications/${a.id}`,{status:'REJECTED',version:0})).statusCode).toBe(200);
  const n=await db.notification.findFirstOrThrow({where:{userId:other.id,shiftId:s.id}});
  expect((await get(other,'/api/me/notifications')).body).not.toContain('Не раскрывать название');expect((await post(other,`/api/me/notifications/${n.id}/read`,{})).statusCode).toBe(404);
 });
 it('после смены глобальной роли notification scope применяется к действующей сессии',async()=>{
  const user=await fixture(207,'LEAD');const s=await db.shift.create({data:{title:'Для ведущих',startDate:new Date('2027-02-01'),endDate:new Date('2027-02-10'),visibility:'ADMIN_LEAD'}});
  const n=await db.notification.create({data:{userId:user.id,shiftId:s.id,kind:'STAFFING',text:'Только ведущим'}});
  expect((await get(user,'/api/me/notifications')).json().total).toBe(1);await db.user.update({where:{id:user.id},data:{role:'TRAINEE'}});
  expect((await get(user,'/api/me/notifications')).json().total).toBe(0);expect((await post(user,`/api/me/notifications/${n.id}/read`,{})).statusCode).toBe(404);
 });
 it('legacy STAFFING без связи не выдаётся, общие уведомления сохранены',async()=>{
  const legacy=await db.notification.create({data:{userId:other.id,kind:'STAFFING',text:'Legacy secret'}});await db.notification.create({data:{userId:other.id,kind:'ACCOUNT',text:'Общее уведомление'}});
  const inbox=await get(other,'/api/me/notifications');expect(inbox.body).not.toContain('Legacy secret');expect(inbox.body).toContain('Общее уведомление');expect((await post(other,`/api/me/notifications/${legacy.id}/read`,{})).statusCode).toBe(404);
 });
 it('blocked account или невидимая смена исчезают из own lists',async()=>{await db.shift.update({where:{id:shiftId},data:{visibility:'ADMIN_ONLY'}});expect((await get(lead,'/api/me/assignments')).json().total).toBe(0);expect((await get(trainee,'/api/me/applications')).json().total).toBe(0);expect((await get(deputy,`/api/shifts/${shiftId}/staffing-history`)).statusCode).toBe(404);await db.user.update({where:{id:lead.id},data:{accountStatus:'REJECTED'}});expect((await get(lead,'/api/me/assignments')).statusCode).toBe(403);});
});
