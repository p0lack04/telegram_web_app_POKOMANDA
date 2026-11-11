import { Prisma, type PrismaClient, type User, type Shift } from '@prisma/client';
import { z } from 'zod';
import { requireRule } from '../errors.js';
import { active, canSeeShift, permissions, requireActive, requireAdmin, visibleShiftWhere, ROLE_PERMISSIONS } from '../domain/permissions.js';
import { applicationTypeFor, requireKnownPosition, staffingActions } from '../domain/staffing.js';
import { applicationDecisionSchema, positionSchema, recruitmentSchema } from '../domain/schemas.js';

type Tx=Prisma.TransactionClient;
const summary={id:true,firstName:true,lastName:true,middleName:true,role:true} as const;
const shiftSummary={id:true,title:true,stage:true} as const;
const applicationInclude={user:{select:summary},shift:{select:shiftSummary}} as const;
const assignmentInclude={user:{select:summary},shift:{select:shiftSummary}} as const;
export class StaffingService {
 constructor(private db:PrismaClient) {}
 private async actor(tx:Tx,id:string) {const user=await tx.user.findUniqueOrThrow({where:{id}});requireActive(user);return user;}
 private async shift(tx:Tx,actor:User,id:string) {
  const shift=await tx.shift.findFirst({where:{id,...visibleShiftWhere(actor)}});
  requireRule(shift,404,'NOT_FOUND','Смена не найдена');return shift;
 }
 private async manager(tx:Tx,actor:User,shift:Shift) {
  const roles=await tx.shiftRole.findMany({where:{userId:actor.id,shiftId:shift.id},select:{position:true}});
  return permissions(actor,shift,roles.map(r=>r.position)).has('shift.manage_roles');
 }
 private async mutate<T>(actorId:string,shiftId:string,fn:(tx:Tx,actor:User,shift:Shift)=>Promise<T>):Promise<T> {
  return this.db.$transaction(async tx=>{
   // Один shift-lock сериализует заявки, решения и назначения этой смены.
   await tx.$queryRaw`SELECT "id" FROM "Shift" WHERE "id" = ${shiftId} FOR UPDATE`;
   const actor=await this.actor(tx,actorId);const shift=await this.shift(tx,actor,shiftId);
   return fn(tx,actor,shift);
  });
 }
 private async record(tx:Tx,actor:User,shift:Shift,action:string,entityType:string,entityId:string,details:Prisma.InputJsonObject,recipientId?:string,text?:string) {
  await tx.auditLog.create({data:{actorId:actor.id,shiftId:shift.id,action,entityType,entityId,details}});
  if(recipientId&&text) await tx.notification.create({data:{userId:recipientId,shiftId:shift.id,kind:'STAFFING',text}});
 }
 async metadata(actorId:string,shiftId:string) {
  return this.db.$transaction(async tx=>{
   const actor=await this.actor(tx,actorId);const shift=await this.shift(tx,actor,shiftId);const manage=await this.manager(tx,actor,shift);
   return {canReview:actor.role==='ADMIN',canManageRoles:manage,positions:manage?Object.keys(ROLE_PERMISSIONS).filter(p=>actor.role==='ADMIN'||p!=='Руководитель'):[],squads:manage?await tx.squad.findMany({where:{shiftId},select:{id:true,name:true},orderBy:[{sortOrder:'asc'},{id:'asc'}]}):[]};
  });
 }
 async applications(actorId:string,shiftId:string|undefined,page:number,pageSize:number) {
  return this.db.$transaction(async tx=>{
   const actor=await this.actor(tx,actorId);if(shiftId)await this.shift(tx,actor,shiftId);
   const where:Prisma.ApplicationWhereInput={...(shiftId?{shiftId}:{}),...(!shiftId||actor.role!=='ADMIN'?{userId:actor.id}:{}),shift:visibleShiftWhere(actor)};
   const items=await tx.application.findMany({where,include:applicationInclude,orderBy:[{createdAt:'desc'},{id:'asc'}],take:pageSize,skip:(page-1)*pageSize});
   return {items,total:await tx.application.count({where}),page,pageSize};
  });
 }
 async submit(actorId:string,shiftId:string,type:'LEAD_RECRUIT'|'TRAINEE_RECRUIT') {
  return this.mutate(actorId,shiftId,async(tx,actor,shift)=>{
   requireRule(applicationTypeFor(actor.role)===type,400,'INVALID_APPLICATION_TYPE','Тип заявки не соответствует вашей роли');
   requireRule(type==='LEAD_RECRUIT'?shift.leadRecruitOpen:shift.traineeRecruitOpen,409,'RECRUITMENT_CLOSED','Набор для вашей роли закрыт');
   const existing=await tx.application.findFirst({where:{shiftId,userId:actor.id}});
   requireRule(!existing,409,'DUPLICATE_APPLICATION','Заявка на эту смену уже существует');
   const application=await tx.application.create({data:{shiftId,userId:actor.id,type},include:applicationInclude});
   await this.record(tx,actor,shift,'APPLICATION_SUBMIT','Application',application.id,{subjectUserId:actor.id,status:'PENDING',type});
   return {application};
  });
 }
 async decide(actorId:string,id:string,body:z.infer<typeof applicationDecisionSchema>) {
  // Lookup не выдаётся клиенту; permission проверяется до любых подробностей заявки.
  const caller=await this.db.user.findUniqueOrThrow({where:{id:actorId}});requireAdmin(caller);
  const reference=await this.db.application.findUnique({where:{id},select:{shiftId:true}});
  requireRule(reference,404,'NOT_FOUND','Заявка не найдена');
  return this.mutate(actorId,reference.shiftId,async(tx,actor,shift)=>{
   requireAdmin(actor);
   const application=await tx.application.findUniqueOrThrow({where:{id},include:{user:true}});
   requireRule(application.status==='PENDING'&&application.version===body.version,409,'APPLICATION_CHANGED','Заявка уже рассмотрена или изменена. Обновите список');
   if(body.status==='APPROVED') requireRule(active(application.user)&&canSeeShift(application.user,shift)&&applicationTypeFor(application.user.role)===application.type,409,'INELIGIBLE_STAFF','Участник больше не соответствует требованиям заявки');
   const changed=await tx.application.updateMany({where:{id,status:'PENDING',version:body.version},data:{status:body.status,version:{increment:1}}});
   requireRule(changed.count===1,409,'APPLICATION_CHANGED','Решение уже принято');
   await this.record(tx,actor,shift,body.status==='APPROVED'?'APPLICATION_APPROVED':'APPLICATION_REJECTED','Application',id,{subjectUserId:application.userId,from:'PENDING',to:body.status},application.userId,`Заявка на смену «${shift.title}»: ${body.status==='APPROVED'?'одобрена':'отклонена'}.`);
   return {application:await tx.application.findUniqueOrThrow({where:{id},include:applicationInclude})};
  });
 }
 async recruitment(actorId:string,shiftId:string,body:z.infer<typeof recruitmentSchema>) {
  return this.mutate(actorId,shiftId,async(tx,actor,shift)=>{
   requireAdmin(actor);
   const updated=await tx.shift.update({where:{id:shiftId},data:body});
   await this.record(tx,actor,shift,'RECRUITMENT_UPDATED','Shift',shiftId,{before:{leadRecruitOpen:shift.leadRecruitOpen,traineeRecruitOpen:shift.traineeRecruitOpen,stage:shift.stage},after:body});
   return {shift:updated};
  });
 }
 async candidates(actorId:string,shiftId:string,search:string,page:number,pageSize:number) {
  return this.db.$transaction(async tx=>{
   const actor=await this.actor(tx,actorId);requireAdmin(actor);const shift=await this.shift(tx,actor,shiftId);
   if(search.length<2)return {items:[],total:0,page,pageSize};
   const eligibleRoles:('LEAD'|'TRAINEE')[]=shift.visibility==='ADMIN_ONLY'?[]:shift.visibility==='ADMIN_LEAD'?['LEAD']:['LEAD','TRAINEE'];
   const where:Prisma.UserWhereInput={isOnboarded:true,accountStatus:'CONFIRMED',role:{in:eligibleRoles},applications:{none:{shiftId}},OR:['firstName','lastName','middleName'].map(field=>({[field]:{contains:search,mode:'insensitive'}}))};
   return {items:await tx.user.findMany({where,select:summary,orderBy:[{lastName:'asc'},{id:'asc'}],take:pageSize,skip:(page-1)*pageSize}),total:await tx.user.count({where}),page,pageSize};
  });
 }
 async addStaff(actorId:string,shiftId:string,userId:string) {
  return this.mutate(actorId,shiftId,async(tx,actor,shift)=>{
   requireAdmin(actor);const target=await tx.user.findUnique({where:{id:userId}});
   requireRule(target&&active(target)&&canSeeShift(target,shift),409,'INELIGIBLE_STAFF','Участник не подтверждён или не имеет доступа к смене');
   const type=applicationTypeFor(target.role);
   requireRule(!await tx.application.findFirst({where:{userId,shiftId}}),409,'DUPLICATE_APPLICATION','Для участника уже существует заявка; используйте её рассмотрение');
   const application=await tx.application.create({data:{shiftId,userId,type,status:'APPROVED'},include:applicationInclude});
   await this.record(tx,actor,shift,'STAFF_ADDED','Application',application.id,{subjectUserId:userId,status:'APPROVED'},userId,`Вы добавлены в персонал смены «${shift.title}».`);
   return {application};
  });
 }
 async staff(actorId:string,shiftId:string,page:number,pageSize:number) {
  return this.db.$transaction(async tx=>{
   const actor=await this.actor(tx,actorId);const shift=await this.shift(tx,actor,shiftId);
   requireRule(await this.manager(tx,actor,shift),403,'FORBIDDEN','Управление персоналом недоступно');
   const where:Prisma.UserWhereInput={applications:{some:{shiftId,status:'APPROVED'}}};
   const users=await tx.user.findMany({where,select:{...summary,applications:{where:{shiftId,status:'APPROVED'},select:{id:true}},shiftRoles:{where:{shiftId},include:assignmentInclude}},orderBy:[{lastName:'asc'},{id:'asc'}],skip:(page-1)*pageSize,take:pageSize});
   return {items:users.map(({applications,shiftRoles,...user})=>({...user,applicationId:applications[0]!.id,positions:shiftRoles})),total:await tx.user.count({where}),page,pageSize};
  });
 }
 async assignments(actorId:string,shiftId:string|undefined,page:number,pageSize:number) {
  return this.db.$transaction(async tx=>{
   const actor=await this.actor(tx,actorId);let manage=false;
   if(shiftId){const shift=await this.shift(tx,actor,shiftId);manage=await this.manager(tx,actor,shift);}
   const where:Prisma.ShiftRoleWhereInput={...(shiftId?{shiftId}:{}),...(!manage?{userId:actor.id}:{}),shift:visibleShiftWhere(actor)};
   return {items:await tx.shiftRole.findMany({where,include:assignmentInclude,orderBy:[{createdAt:'desc'},{id:'asc'}],skip:(page-1)*pageSize,take:pageSize}),total:await tx.shiftRole.count({where}),page,pageSize};
  });
 }
 async assign(actorId:string,shiftId:string,body:z.infer<typeof positionSchema>) {
  return this.mutate(actorId,shiftId,async(tx,actor,shift)=>{
   requireRule(await this.manager(tx,actor,shift),403,'FORBIDDEN','Нет права управления должностями');requireKnownPosition(body.position,actor.role);
   const target=await tx.user.findUnique({where:{id:body.userId}});
   requireRule(target&&active(target)&&canSeeShift(target,shift),409,'INELIGIBLE_STAFF','Участник не подтверждён или смена ему недоступна');
   requireRule(await tx.application.findFirst({where:{shiftId,userId:body.userId,status:'APPROVED'}}),409,'STAFF_NOT_ADMITTED','Сначала примите сотрудника на смену');
   if(body.squadId) requireRule(await tx.squadMember.findFirst({where:{squadId:body.squadId,shiftId,userId:body.userId}}),409,'SQUAD_MEMBERSHIP_REQUIRED','Назначение требует членства в этом отряде этой смены');
   const assignment=await tx.shiftRole.create({data:{shiftId,userId:body.userId,position:body.position,squadId:body.squadId??null},include:assignmentInclude});
   await this.record(tx,actor,shift,'POSITION_ASSIGNED','ShiftRole',assignment.id,{subjectUserId:body.userId,position:body.position,squadId:body.squadId??null},body.userId,`Смена «${shift.title}»: назначена должность «${body.position}».`);
   return {assignment};
  });
 }
 async removeAssignment(actorId:string,shiftId:string,id:string) {
  return this.mutate(actorId,shiftId,async(tx,actor,shift)=>{
   requireRule(await this.manager(tx,actor,shift),403,'FORBIDDEN','Нет права управления должностями');
   const assignment=await tx.shiftRole.findFirst({where:{id,shiftId}});requireRule(assignment,404,'NOT_FOUND','Назначение не найдено');requireKnownPosition(assignment.position,actor.role);
   await tx.shiftRole.delete({where:{id}});
   await this.record(tx,actor,shift,'POSITION_REMOVED','ShiftRole',id,{subjectUserId:assignment.userId,position:assignment.position,squadId:assignment.squadId},assignment.userId,`Смена «${shift.title}»: снята должность «${assignment.position}».`);
  });
 }
 async history(actorId:string,shiftId:string,page:number,pageSize:number) {
  return this.db.$transaction(async tx=>{
   const actor=await this.actor(tx,actorId);const shift=await this.shift(tx,actor,shiftId);const manage=await this.manager(tx,actor,shift);
   const where:Prisma.AuditLogWhereInput={shiftId,action:{in:[...staffingActions]},...(actor.role==='ADMIN'?{}:manage?{action:{in:['POSITION_ASSIGNED','POSITION_REMOVED']}}:{details:{path:['subjectUserId'],equals:actor.id}})};
   const items=await tx.auditLog.findMany({where,select:{id:true,action:true,entityType:true,entityId:true,createdAt:true,details:true,actor:{select:{id:true,firstName:true,lastName:true,middleName:true}}},orderBy:[{createdAt:'desc'},{id:'asc'}],skip:(page-1)*pageSize,take:pageSize});
   const subjectId=(details:Prisma.JsonValue)=>details&&typeof details==='object'&&!Array.isArray(details)&&typeof details.subjectUserId==='string'?details.subjectUserId:undefined;
   const ids=items.map(item=>subjectId(item.details)).filter((id):id is string=>!!id);
   const subjects=await tx.user.findMany({where:{id:{in:ids}},select:summary});
   return {items:items.map(item=>({...item,subject:subjects.find(user=>user.id===subjectId(item.details))??null})),total:await tx.auditLog.count({where}),page,pageSize};
  });
 }
 private notificationWhere(actor:User):Prisma.NotificationWhereInput {
  return {userId:actor.id,OR:[{shift:{is:visibleShiftWhere(actor)}},{shiftId:null,kind:{not:'STAFFING'}}]};
 }
 async notifications(actorId:string,page:number,pageSize:number) {
  return this.db.$transaction(async tx=>{const actor=await this.actor(tx,actorId);const where=this.notificationWhere(actor);return {items:await tx.notification.findMany({where,orderBy:[{createdAt:'desc'},{id:'asc'}],take:pageSize,skip:(page-1)*pageSize}),total:await tx.notification.count({where}),page,pageSize};});
 }
 async readNotification(actorId:string,id:string) {
  return this.db.$transaction(async tx=>{const actor=await this.actor(tx,actorId);const notification=await tx.notification.findFirst({where:{id,...this.notificationWhere(actor)}});requireRule(notification,404,'NOT_FOUND','Уведомление не найдено');return {notification:await tx.notification.update({where:{id},data:{readAt:notification.readAt??new Date()}})};});
 }
}
