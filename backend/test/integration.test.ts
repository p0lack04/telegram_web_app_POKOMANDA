import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {PrismaClient} from '@prisma/client';
import EmbeddedPostgres from 'embedded-postgres';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:net';
import {execFileSync} from 'node:child_process';
import {createHmac,randomBytes} from 'node:crypto';
import type {FastifyInstance} from 'fastify';
import {buildApp} from '../src/app.js';
import {hashToken} from '../src/services/auth.js';

const botToken='123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijk';
const origin='http://localhost:5173';
let pg:EmbeddedPostgres;let db:PrismaClient;let app:FastifyInstance;
let adminCookie:string,traineeCookie:string,pendingCookie:string,leadCookie:string;
let pendingId:string;let hiddenId:string;let sharedId:string;
const headers=(cookie:string)=>({cookie,origin});
function initData(id:number,query_id=randomBytes(10).toString('hex')) {
 const params=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:'Тест'}),query_id});
 const key=createHmac('sha256','WebAppData').update(botToken).digest();
 const check=[...params].sort(([a],[b])=>a<b?-1:1).map(([k,v])=>`${k}=${v}`).join('\n');
 params.set('hash',createHmac('sha256',key).update(check).digest('hex'));return params.toString();
}
beforeAll(async()=>{
 const server=createServer();await new Promise<void>(res=>server.listen(0,'127.0.0.1',res));const address=server.address();if(!address||typeof address==='string')throw new Error('port unavailable');const port=address.port;await new Promise<void>(res=>server.close(()=>res()));
 const directory=await mkdtemp(join(tmpdir(),'komanda-postgres-'));
 const password=randomBytes(20).toString('hex');
 pg=new EmbeddedPostgres({databaseDir:join(directory,'data'),user:'postgres',password,port,persistent:false,autoRehydrateSymlinks:true,postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{}});
 await pg.initialise();await pg.start();await pg.createDatabase('komanda_test');
 // Credentials берутся из конфигурации тестового кластера; никакой внешней БД не очищаем.
 const url=`postgresql://postgres:${password}@127.0.0.1:${port}/komanda_test`;
 execFileSync(process.execPath,[resolve('../node_modules/prisma/build/index.js'),'migrate','deploy','--schema',resolve('prisma/schema.prisma')],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
 db=new PrismaClient({datasources:{db:{url}}});
 app=await buildApp({NODE_ENV:'test',HOST:'127.0.0.1',PORT:3001,DATABASE_URL:url,APP_ORIGIN:origin,TELEGRAM_BOT_TOKEN:botToken},db);
 async function fixture(id:number,role:'ADMIN'|'LEAD'|'TRAINEE',accountStatus:'CONFIRMED'|'PENDING') {
  const user=await db.user.create({data:{telegramId:BigInt(id),firstName:'Тест',lastName:'Участник',role,accountStatus,isOnboarded:true}});
  const token=randomBytes(32).toString('base64url');await db.session.create({data:{userId:user.id,tokenHash:hashToken(token),expiresAt:new Date(Date.now()+3600000)}});
  return {user,cookie:`komanda_session=${token}`};
 }
 adminCookie=(await fixture(100,'ADMIN','CONFIRMED')).cookie;traineeCookie=(await fixture(101,'TRAINEE','CONFIRMED')).cookie;leadCookie=(await fixture(102,'LEAD','CONFIRMED')).cookie;
 const pending=await fixture(103,'TRAINEE','PENDING');pendingCookie=pending.cookie;pendingId=pending.user.id;
 hiddenId=(await db.shift.create({data:{title:'Скрытая',startDate:new Date('2027-01-01'),endDate:new Date('2027-01-10')}})).id;
 sharedId=(await db.shift.create({data:{title:'Открытая',startDate:new Date('2027-02-01'),endDate:new Date('2027-02-10'),visibility:'ADMIN_LEAD_TRAINEE'}})).id;
},120000);
afterAll(async()=>{if(app)await app.close();if(db)await db.$disconnect();if(pg)await pg.stop();},30000);

describe('реальный PostgreSQL + HTTP',()=>{
 it('миграция создала таблицы',async()=>expect(await db.shift.count()).toBe(2));
 it('без cookie нет доступа',async()=>expect((await app.inject({url:'/api/shifts'})).statusCode).toBe(401));
 it('pending не читает доменные данные',async()=>expect((await app.inject({url:'/api/shifts',headers:headers(pendingCookie)})).statusCode).toBe(403));
 it('скрывает смену в списке и по прямому ID',async()=>{
  for(const cookie of [traineeCookie,leadCookie]){const list=await app.inject({url:'/api/shifts',headers:headers(cookie)});expect(list.json().items.map((s:{id:string})=>s.id)).not.toContain(hiddenId);expect((await app.inject({url:'/api/shifts/'+hiddenId,headers:headers(cookie)})).statusCode).toBe(404);}
 });
 it('отдаёт доступную смену',async()=>expect((await app.inject({url:'/api/shifts/'+sharedId,headers:headers(traineeCookie)})).statusCode).toBe(200));
 it('не позволяет стажёру создавать смену',async()=>expect((await app.inject({method:'POST',url:'/api/shifts',headers:headers(traineeCookie),payload:{title:'Запрет',startDate:'2027-01-01',endDate:'2027-01-02'}})).statusCode).toBe(403));
 it('создаёт смену и аудит в транзакции',async()=>{const response=await app.inject({method:'POST',url:'/api/shifts',headers:headers(adminCookie),payload:{title:'Новая',startDate:'2027-01-01',endDate:'2027-01-02'}});expect(response.statusCode).toBe(201);expect(await db.auditLog.count({where:{entityId:response.json().shift.id}})).toBe(1);});
 it('отклоняет cross-origin POST',async()=>expect((await app.inject({method:'POST',url:'/api/shifts',headers:{cookie:adminCookie,origin:'https://evil.example'},payload:{}})).statusCode).toBe(403));
 it('отклоняет отсутствие Origin',async()=>expect((await app.inject({method:'POST',url:'/api/auth/logout',headers:{cookie:adminCookie},payload:{}})).statusCode).toBe(403));
 it('не раскрывает технические поля и BigInt',async()=>{const result=await app.inject({url:'/api/auth/me',headers:headers(traineeCookie)});expect(result.statusCode).toBe(200);expect(result.json().user).not.toHaveProperty('telegramId');expect(result.json().user).not.toHaveProperty('confirmedById');});
 it('проверяет pagination и неизвестные поля',async()=>expect((await app.inject({url:'/api/shifts?pageSize=1000',headers:headers(adminCookie)})).statusCode).toBe(400));
 it('запрещает подтверждение ведущему',async()=>expect((await app.inject({method:'POST',url:'/api/users/'+pendingId+'/confirm',headers:headers(leadCookie),payload:{}})).statusCode).toBe(403));
 it('подтверждает pending и учитывает новый статус в текущей сессии',async()=>{const result=await app.inject({method:'POST',url:'/api/users/'+pendingId+'/confirm',headers:headers(adminCookie),payload:{}});expect(result.statusCode).toBe(200);expect((await app.inject({url:'/api/shifts',headers:headers(pendingCookie)})).statusCode).toBe(200);expect((await app.inject({method:'POST',url:'/api/users/'+pendingId+'/reject',headers:headers(adminCookie),payload:{}})).statusCode).toBe(409);});
 it('Telegram login создаёт cookie и не допускает replay с перестановкой параметров',async()=>{const data=initData(900);const response=await app.inject({method:'POST',url:'/api/auth/telegram',headers:{origin},payload:{initData:data}});expect(response.statusCode).toBe(200);expect(response.headers['set-cookie']).toContain('HttpOnly');expect(response.headers['set-cookie']).toContain('SameSite=Strict');expect(response.json().user.role).toBe('TRAINEE');const reordered=new URLSearchParams([...new URLSearchParams(data)].reverse()).toString();expect((await app.inject({method:'POST',url:'/api/auth/telegram',headers:{origin},payload:{initData:reordered}})).statusCode).toBe(401);});
 it('запрещает эскалацию роли через onboard',async()=>{const login=await app.inject({method:'POST',url:'/api/auth/telegram',headers:{origin},payload:{initData:initData(901)}});const cookie=String(login.headers['set-cookie']).split(';')[0]!;const body={firstName:'Тест',lastName:'Тест',birthDate:'2000-01-01',confirmed:true,creativeTaskUrl:'https://example.com/task',presentationUrl:'https://example.com/presentation'};expect((await app.inject({method:'POST',url:'/api/auth/onboard',headers:headers(cookie),payload:{...body,role:'ADMIN'}})).statusCode).toBe(400);const onboard=await app.inject({method:'POST',url:'/api/auth/onboard',headers:headers(cookie),payload:body});expect(onboard.statusCode).toBe(200);expect(onboard.json().user.accountStatus).toBe('PENDING');expect((await app.inject({url:'/api/shifts',headers:headers(cookie)})).statusCode).toBe(403);});
 it('ближайшие смены фильтруются и сортируются до пагинации',async()=>{const past=await db.shift.create({data:{title:'Архив',startDate:new Date('2000-01-01'),endDate:new Date('2000-01-02'),visibility:'ADMIN_LEAD_TRAINEE'}});const result=await app.inject({url:'/api/shifts?upcoming=true&pageSize=2',headers:headers(traineeCookie)});const items=result.json().items as {id:string;startDate:string}[];expect(items.map(v=>v.id)).not.toContain(past.id);expect(items.map(v=>v.startDate)).toEqual(items.map(v=>v.startDate).sort());});
 it('БД запрещает связь должности с отрядом другой смены',async()=>{const squad=await db.squad.create({data:{name:'Чужой отряд',shiftId:hiddenId}});const user=await db.user.findFirstOrThrow();await expect(db.shiftRole.create({data:{userId:user.id,shiftId:sharedId,squadId:squad.id,position:'Ведущий отряда'}})).rejects.toThrow();});
 it('БД запрещает повторную submission и вопрос другого опроса',async()=>{const user=await db.user.findFirstOrThrow();const survey=await db.survey.create({data:{title:'Тест',shiftId:sharedId,createdById:user.id,surveyType:'GENERAL',audience:'ALL'}});const other=await db.survey.create({data:{title:'Другой',shiftId:sharedId,createdById:user.id,surveyType:'GENERAL',audience:'ALL'}});const question=await db.surveyQuestion.create({data:{surveyId:other.id,questionText:'Вопрос',questionType:'TEXT',options:[]}});const submission=await db.surveySubmission.create({data:{surveyId:survey.id,userId:user.id}});await expect(db.surveySubmission.create({data:{surveyId:survey.id,userId:user.id}})).rejects.toThrow();await expect(db.surveyAnswer.create({data:{surveyId:survey.id,questionId:question.id,submissionId:submission.id,answerText:'Ответ',answerOptions:[]}})).rejects.toThrow();});
 it('БД отклоняет PARTIAL без примечания и неверную child identity',async()=>{const squad=await db.squad.create({data:{name:'Тестовый',shiftId:sharedId}});await expect(db.squadMember.create({data:{squadId:squad.id,shiftId:sharedId,firstName:'Имя',lastName:'Фамилия',memberType:'CHILD',paymentStatus:'PARTIAL'}})).rejects.toThrow();const staff=await db.user.findFirstOrThrow();await expect(db.squadMember.create({data:{squadId:squad.id,shiftId:sharedId,userId:staff.id,firstName:'Имя',lastName:'Фамилия',memberType:'CHILD'}})).rejects.toThrow();});
});
