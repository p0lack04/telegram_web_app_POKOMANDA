import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PrismaClient, User } from '@prisma/client';
import { z } from 'zod';
import { onboardingSchema, shiftSchema, pagination, idParam } from '../domain/schemas.js';
import { requireActive, requireAdmin, visibleShiftWhere } from '../domain/permissions.js';
import { requireRule } from '../errors.js';
import { selfDto } from '../services/dto.js';
import type { AuthService } from '../services/auth.js';
import { registerStaffingRoutes } from './staffing.js';
import type { Config } from '../config.js';

export function registerRoutes(app:FastifyInstance, db:PrismaClient, auth:AuthService,config:Config) {
 const cookieName=config.NODE_ENV==='production'?'__Host-komanda':'komanda_session';
 const cookieOptions={httpOnly:true,secure:config.NODE_ENV==='production',sameSite:'strict' as const,path:'/'};
 const userFor=(request:FastifyRequest)=>auth.authenticate(request.cookies[cookieName]);
 const activeUser=async (request:FastifyRequest)=> { const user=await userFor(request); requireActive(user); return user; };
 const admin=async (request:FastifyRequest)=> { const user=await userFor(request); requireAdmin(user); return user; };
 registerStaffingRoutes(app,db,activeUser);
 const audit=(actor:User,action:string,entityType:string,entityId:string)=>({actorId:actor.id,action,entityType,entityId});
 app.get('/health',async()=>({status:'ok'}));
 app.post('/api/auth/telegram', {config:{rateLimit:{max:10,timeWindow:'1 minute'}}},async(request,reply)=>{
  const {initData}=z.object({initData:z.string().min(1).max(16384)}).strict().parse(request.body);
  const result=await auth.login(initData);
  const oldToken=request.cookies[cookieName];
  if(oldToken) await auth.logout(oldToken);
  reply.setCookie(cookieName,result.token,{...cookieOptions,expires:result.expiresAt});
  return {user:selfDto(result.user)};
 });
 app.get('/api/auth/me',async(request)=>({user:selfDto(await userFor(request))}));
 app.get('/api/auth/onboard/status',async(request)=>{
  const user=await userFor(request); return {isOnboarded:user.isOnboarded,accountStatus:user.accountStatus};
 });
 app.post('/api/auth/logout',async(request,reply)=>{
  await auth.logout(request.cookies[cookieName]); reply.clearCookie(cookieName,cookieOptions).code(204).send();
 });
 app.post('/api/auth/onboard',async(request)=>{
  const actor=await userFor(request);
  const body=onboardingSchema.parse(request.body);
  requireRule(!actor.isOnboarded || actor.accountStatus==='REJECTED',409,'ALREADY_ONBOARDED','Анкета уже отправлена');
  if(actor.role==='TRAINEE') requireRule(body.confirmed && body.creativeTaskUrl && body.presentationUrl,400,'TRAINEE_LINKS_REQUIRED','Подтвердите данные и укажите ссылки на задание и презентацию');
  const user=await db.$transaction(async tx=>{
   // CAS не позволяет двум формам одновременно менять уже отправленную анкету.
   const changed=await tx.user.updateMany({where:{id:actor.id,OR:[{isOnboarded:false},{accountStatus:'REJECTED'}]},data:{
    firstName:body.firstName,lastName:body.lastName,middleName:body.middleName||null,birthDate:new Date(body.birthDate+'T00:00:00Z'),
    phone:body.phone||null,manualShiftsCount:body.manualShiftsCount,manualExperience:body.manualExperience||null,
    creativeTaskUrl:body.creativeTaskUrl||null,presentationUrl:body.presentationUrl||null,
    isOnboarded:true,accountStatus:actor.role==='TRAINEE'?'PENDING':'CONFIRMED',
    confirmedById:actor.role==='TRAINEE'?null:actor.id,confirmedAt:actor.role==='TRAINEE'?null:new Date(),
   }});
   requireRule(changed.count===1,409,'ALREADY_ONBOARDED','Анкета уже отправлена');
   await tx.auditLog.create({data:audit(actor,'ONBOARD','User',actor.id)});
   return tx.user.findUniqueOrThrow({where:{id:actor.id}});
  });
  return {user:selfDto(user)};
 });
 app.get('/api/users/pending',async(request)=>{
  await admin(request);
  const {page,pageSize}=pagination.parse(request.query);
  const where={accountStatus:'PENDING' as const,isOnboarded:true};
  const [items,total]=await db.$transaction([db.user.findMany({where,orderBy:[{createdAt:'asc'},{id:'asc'}],take:pageSize,skip:(page-1)*pageSize}),db.user.count({where})]);
  return {items:items.map(selfDto),total,page,pageSize};
 });
 for(const decision of ['confirm','reject'] as const) app.post(`/api/users/:id/${decision}`,async(request)=>{
  const actor=await admin(request); const {id}=idParam.parse(request.params);
  z.object({}).strict().parse(request.body??{});
  requireRule(id!==actor.id,400,'SELF_DECISION','Нельзя подтверждать собственную анкету');
  const user=await db.$transaction(async tx=>{
   const target=await tx.user.findUnique({where:{id}});
   requireRule(target && target.isOnboarded,404,'NOT_FOUND','Анкета не найдена');
   requireRule(target.role!=='ADMIN',403,'FORBIDDEN','Эта операция не применяется к руководителю');
   requireRule(target.accountStatus==='PENDING',409,'ALREADY_DECIDED','Решение по анкете уже принято');
   const changed=await tx.user.updateMany({where:{id,accountStatus:'PENDING'},data:{accountStatus:decision==='confirm'?'CONFIRMED':'REJECTED',confirmedById:actor.id,confirmedAt:new Date()}});
   requireRule(changed.count===1,409,'ALREADY_DECIDED','Решение по анкете уже принято');
   if(decision==='reject') await tx.session.deleteMany({where:{userId:id}});
   await tx.auditLog.create({data:audit(actor,decision.toUpperCase(),'User',id)});
   return tx.user.findUniqueOrThrow({where:{id}});
  });
  return {user:selfDto(user)};
 });
 app.get('/api/shifts',async(request)=>{
  const actor=await activeUser(request); const {page,pageSize,upcoming}=pagination.extend({upcoming:z.literal('true').optional()}).parse(request.query);
  const where={...visibleShiftWhere(actor),...(upcoming?{endDate:{gte:new Date(new Date().toISOString().slice(0,10)+'T00:00:00Z')}}:{})};
  const [items,total]=await db.$transaction([db.shift.findMany({where,orderBy:[{startDate:upcoming?'asc':'desc'},{id:'asc'}],take:pageSize,skip:(page-1)*pageSize}),db.shift.count({where})]);
  return {items,total,page,pageSize};
 });
 app.get('/api/shifts/:id',async(request)=>{
  const actor=await activeUser(request);const {id}=idParam.parse(request.params);
  const shift=await db.shift.findFirst({where:{id,...visibleShiftWhere(actor)}});
  requireRule(shift,404,'NOT_FOUND','Смена не найдена');return {shift};
 });
 app.post('/api/shifts',async(request,reply)=>{
  const actor=await admin(request);const body=shiftSchema.parse(request.body);
  const shift=await db.$transaction(async tx=>{
   const shift=await tx.shift.create({data:{...body,startDate:new Date(body.startDate+'T00:00:00Z'),endDate:new Date(body.endDate+'T00:00:00Z')}});
   await tx.auditLog.create({data:audit(actor,'CREATE','Shift',shift.id)});return shift;
  });
  reply.code(201);return {shift};
 });
}
