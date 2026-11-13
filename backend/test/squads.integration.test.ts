import {beforeAll,afterAll,describe,it,expect} from 'vitest';
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

const origin='http://localhost:5173';
let pg:EmbeddedPostgres,db:PrismaClient,app:FastifyInstance;
let admin:User,own:User,all:User,memberOnly:User,nullRole:User,pending:User,cross:User;
let shift:string,otherShift:string,hidden:string,a:string,b:string,c:string,d:string,foreign:string;
const cookies=new Map<string,string>();
const get=(user:User,url:string)=>app.inject({url,headers:{cookie:cookies.get(user.id)!,origin}});
async function fixture(n:number,role:User['role'],confirmed=true) {
 const user=await db.user.create({data:{telegramId:BigInt(n),firstName:'Test',role,isOnboarded:true,accountStatus:confirmed?'CONFIRMED':'PENDING'}});
 const token=randomBytes(32).toString('base64url');await db.session.create({data:{userId:user.id,tokenHash:hashToken(token),expiresAt:new Date(Date.now()+3600000)}});cookies.set(user.id,`komanda_session=${token}`);return user;
}
beforeAll(async()=>{
 const listener=createServer();await new Promise<void>(r=>listener.listen(0,'127.0.0.1',r));const address=listener.address();if(!address||typeof address==='string')throw Error('port');const port=address.port;await new Promise<void>(r=>listener.close(()=>r()));
 const password=randomBytes(20).toString('hex');const dir=await mkdtemp(join(tmpdir(),'komanda-squads-'));
 pg=new EmbeddedPostgres({databaseDir:join(dir,'data'),user:'postgres',password,port,persistent:false,autoRehydrateSymlinks:true,postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{}});
 await pg.initialise();await pg.start();await pg.createDatabase('squads');
 const url=`postgresql://postgres:${password}@127.0.0.1:${port}/squads`;db=new PrismaClient({datasources:{db:{url}}});
 execFileSync(process.execPath,[resolve('../node_modules/prisma/build/index.js'),'migrate','deploy','--schema',resolve('prisma/schema.prisma')],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
 app=await buildApp({NODE_ENV:'test',HOST:'127.0.0.1',PORT:3001,DATABASE_URL:url,APP_ORIGIN:origin,TELEGRAM_BOT_TOKEN:'123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijk'},db);
 [admin,own,all,memberOnly,nullRole,pending,cross]=await Promise.all([fixture(501,'ADMIN'),fixture(502,'TRAINEE'),fixture(503,'LEAD'),fixture(504,'TRAINEE'),fixture(505,'TRAINEE'),fixture(506,'TRAINEE',false),fixture(507,'TRAINEE')]);
 const makeShift=(title:string,visibility:'ADMIN_ONLY'|'ADMIN_LEAD_TRAINEE')=>db.shift.create({data:{title,visibility,startDate:new Date('2027-01-01'),endDate:new Date('2027-01-10')}});
 shift=(await makeShift('Visible','ADMIN_LEAD_TRAINEE')).id;otherShift=(await makeShift('Other','ADMIN_LEAD_TRAINEE')).id;hidden=(await makeShift('Hidden','ADMIN_ONLY')).id;
 const makeSquad=(shiftId:string,name:string,sortOrder:number)=>db.squad.create({data:{shiftId,name,sortOrder}});
 a=(await makeSquad(shift,'A',1)).id;b=(await makeSquad(shift,'B',2)).id;c=(await makeSquad(shift,'C',3)).id;d=(await makeSquad(shift,'D',4)).id;foreign=(await makeSquad(otherShift,'Foreign',1)).id;
 const member=(user:User,squadId:string,shiftId:string)=>db.squadMember.create({data:{userId:user.id,squadId,shiftId,firstName:'Secret',lastName:'Person',memberType:'TRAINEE'}});
 await member(own,a,shift);await member(own,b,shift);await member(memberOnly,a,shift);await member(cross,foreign,otherShift);
 await db.shiftRole.createMany({data:[{userId:own.id,shiftId:shift,position:'Стажёр',squadId:c},{userId:all.id,shiftId:shift,position:'Стажёр',squadId:a},{userId:all.id,shiftId:shift,position:'Ответственный за программу'},{userId:nullRole.id,shiftId:shift,position:'Стажёр'},{userId:cross.id,shiftId:otherShift,position:'Ответственный за программу'},{userId:memberOnly.id,shiftId:shift,position:'unknown'}]});
},120000);
afterAll(async()=>{if(app)await app.close();if(db)await db.$disconnect();if(pg)await pg.stop();},30000);

describe('squad read HTTP + PostgreSQL',()=>{
 const list=()=>`/api/shifts/${shift}/squads`;
 const detail=(id:string)=>`${list()}/${id}`;
 it('admin and view_all including combined permissions return exact DTO',async()=>{
  for(const actor of [admin,all]) {const res=await get(actor,list());expect(res.statusCode).toBe(200);expect(res.json().total).toBe(4);expect(res.json().items.map((s:{id:string})=>s.id)).toEqual([a,b,c,d]);for(const squad of res.json().items)expect(Object.keys(squad).sort()).toEqual(['color','id','name','sortOrder']);const one=await get(actor,detail(c));expect(one.statusCode).toBe(200);expect(one.json()).toEqual({squad:res.json().items[2]});}
 });
 it('own union of role and multiple memberships with filtered pagination',async()=>{
  const res=await get(own,`${list()}?page=2&pageSize=1`);expect(res.statusCode).toBe(200);expect(res.json()).toMatchObject({page:2,pageSize:1,total:3,items:[{id:b}]});
  expect((await get(own,detail(c))).statusCode).toBe(200);expect((await get(own,detail(a))).statusCode).toBe(200);expect((await get(own,detail(d))).statusCode).toBe(404);
  const isolated=await get(nullRole,list());expect(isolated.json()).toMatchObject({items:[],total:0});expect((await get(nullRole,detail(a))).statusCode).toBe(404);
 });
 it('membership, unknown role and other-shift roles do not grant permission',async()=>{
  for(const actor of [memberOnly,cross]) {expect((await get(actor,list())).statusCode).toBe(403);expect((await get(actor,detail(a))).statusCode).toBe(404);expect((await get(actor,detail('missing'))).statusCode).toBe(404);}
 });
 it('validates pagination and filters a view_all user by the requested shift',async()=>{
  for(const query of ['page=0','pageSize=101','page=abc','include=members'])expect((await get(admin,`${list()}?${query}`)).statusCode).toBe(400);
  const res=await get(all,`${list()}?page=5&pageSize=1`);expect(res.statusCode).toBe(200);expect(res.json()).toMatchObject({items:[],total:4});
  expect((await get(all,detail(foreign))).statusCode).toBe(404);
  expect((await get(all,`/api/shifts/${otherShift}/squads`)).statusCode).toBe(403);
 });
 it('rechecks account readiness on both endpoints for existing sessions',async()=>{
  try {
   for(const state of [{accountStatus:'PENDING',isOnboarded:true},{accountStatus:'REJECTED',isOnboarded:true},{accountStatus:'CONFIRMED',isOnboarded:false}] as const){
    await db.user.update({where:{id:all.id},data:state});
    for(const url of [list(),detail(a)]){const res=await get(all,url);expect(res.statusCode).toBe(403);expect(res.json().error.code).toBe('ACCOUNT_NOT_READY');}
   }
  } finally {await db.user.update({where:{id:all.id},data:{accountStatus:'CONFIRMED',isOnboarded:true}});}
 });
 it('object, shift, authentication and query boundaries',async()=>{
  expect((await get(own,detail(foreign))).statusCode).toBe(404);expect((await get(own,detail('missing'))).statusCode).toBe(404);
  expect((await get(own,`/api/shifts/${hidden}/squads`)).statusCode).toBe(404);expect((await get(own,`/api/shifts/${hidden}/squads/${a}`)).statusCode).toBe(404);expect((await get(admin,'/api/shifts/missing/squads')).statusCode).toBe(404);
  expect((await get(pending,list())).statusCode).toBe(403);expect((await app.inject({url:list()})).statusCode).toBe(401);
  expect((await get(own,`${list()}?userId=${admin.id}`)).statusCode).toBe(400);expect((await get(own,`${detail(a)}?userId=${admin.id}`)).statusCode).toBe(400);
 });
});

describe('child endpoints',()=>{
 const url=()=>`/api/shifts/${shift}/squads/${a}/children`;
 const post=(actor:User,payload:object)=>app.inject({method:'POST',url:url(),headers:{cookie:cookies.get(actor.id)!,origin},payload});
 it('view_all cannot widen local squad management',async()=>{
  await db.shiftRole.create({data:{userId:all.id,shiftId:shift,position:'Ведущий отряда',squadId:a}});
  const payload={firstName:'Scope',lastName:'Synthetic',birthDate:'2015-01-02'};
  expect((await post(all,payload)).statusCode).toBe(201);
  expect((await get(all,`/api/shifts/${shift}/squads/${d}`)).statusCode).toBe(200);
  expect((await app.inject({method:'POST',url:`/api/shifts/${shift}/squads/${d}/children`,headers:{cookie:cookies.get(all.id)!,origin},payload})).statusCode).toBe(404);
 });
 it('checks management scope and immutable identity',async()=>{
  const payload={firstName:'Имя',lastName:'Фамилия',birthDate:'2015-01-02'};
  expect((await post(own,payload)).statusCode).toBe(403);
  expect((await post(admin,{...payload,userId:admin.id})).statusCode).toBe(400);
  const created=await post(admin,payload);expect(created.statusCode).toBe(201);
  const id=created.json().member.id as string;
  expect((await get(own,`${url()}/${id}`)).statusCode).toBe(200);
  expect((await get(nullRole,`${url()}/${id}`)).statusCode).toBe(404);
  expect((await app.inject({method:'PATCH',url:`${url()}/${id}`,headers:{cookie:cookies.get(admin.id)!,origin},payload:{firstName:'Другое'}})).statusCode).toBe(400);
  const changed=await app.inject({method:'PATCH',url:`${url()}/${id}`,headers:{cookie:cookies.get(admin.id)!,origin},payload:{building:'A',room:'1',squadId:b}});
  expect(changed.statusCode).toBe(200);expect(changed.json().member.squadId).toBe(b);
  expect((await get(admin,`${url()}/${id}`)).statusCode).toBe(404);
 });
});
