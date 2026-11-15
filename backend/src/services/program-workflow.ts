import type {PrismaClient, Prisma} from '@prisma/client';
import {permissions, requireActive, visibleShiftWhere} from '../domain/permissions.js';
import {requireRule} from '../errors.js';
import {z} from 'zod';
import {programItemCreateSchema,programItemUpdateSchema} from '../domain/schemas.js';

export function programConflicts(items: Array<{id:string;date:Date;startTime:string;endTime:string}>) {
 return items.flatMap((a,i)=>items.slice(i+1).filter(b=>a.date.getTime()===b.date.getTime()&&a.startTime<b.endTime&&b.startTime<a.endTime).map(b=>({firstId:a.id,secondId:b.id,date:a.date.toISOString().slice(0,10)})));
}
type Tx=Prisma.TransactionClient;
export class ProgramWorkflowService {
 constructor(private db:PrismaClient) {}
 private async context(tx:Tx,actorId:string,shiftId:string) {
  const actor=await tx.user.findUniqueOrThrow({where:{id:actorId}});requireActive(actor);
  const shift=await tx.shift.findFirst({where:{id:shiftId,...visibleShiftWhere(actor)}});
  requireRule(shift,404,'NOT_FOUND','Смена не найдена');
  const roles=await tx.shiftRole.findMany({where:{shiftId,userId:actorId},select:{position:true}});
  return {actor,perms:permissions(actor,shift,roles.map(r=>r.position))};
 }
 private async view(tx:Tx,actorId:string,shiftId:string) {
  const c=await this.context(tx,actorId,shiftId);
  const admitted=!!await tx.application.findFirst({where:{shiftId,userId:actorId,status:'APPROVED'}});
  requireRule(c.actor.role==='ADMIN'||c.perms.has('program.view')||admitted,403,'FORBIDDEN','Нет доступа к программе смены');
  return {...c,admitted};
 }
 private async locked<T>(actorId:string,shiftId:string,fn:(tx:Tx,c:Awaited<ReturnType<ProgramWorkflowService['view']>>)=>Promise<T>) {
  return this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "Shift" WHERE id = ${shiftId} FOR UPDATE`;
   return fn(tx,await this.view(tx,actorId,shiftId));
  });
 }
 async list(actorId:string,shiftId:string,date?:string) {
  return this.db.$transaction(async tx=>{
   const c=await this.view(tx,actorId,shiftId);
   const days=await tx.programItem.findMany({where:{shiftId},select:{date:true},distinct:['date'],orderBy:{date:'asc'}});
   const selectedDate=date&&days.some(x=>x.date.toISOString().slice(0,10)===date)?new Date(date+'T00:00:00Z'):days[0]?.date;
   const items=await tx.programItem.findMany({where:{shiftId,...(selectedDate?{date:selectedDate}:{})},orderBy:[{date:'asc'},{sortOrder:'asc'},{startTime:'asc'},{id:'asc'}],include:{bankEvent:{select:{id:true,title:true,category:true,isPublic:true,authorId:true}},responsible:{select:{id:true,firstName:true,lastName:true}}}});
   return {days:days.map(x=>x.date.toISOString().slice(0,10)),date:selectedDate?.toISOString().slice(0,10)??null,items:items.map(item=>{
    const bankAccessible=!!item.bankEvent&&(item.bankEvent.isPublic||item.bankEvent.authorId===actorId||c.actor.role==='ADMIN');
    return {id:item.id,shiftId:item.shiftId,title:item.title,description:item.description,date:item.date,startTime:item.startTime,endTime:item.endTime,location:item.location,type:item.type,responsibleId:item.responsibleId,responsible:item.responsible,sortOrder:item.sortOrder,isLocked:item.isLocked,createdAt:item.createdAt,updatedAt:item.updatedAt,bankEvent:bankAccessible?{id:item.bankEvent!.id,title:item.bankEvent!.title,category:item.bankEvent!.category}:null,bankEventId:bankAccessible?item.bankEventId:null,capabilities:{edit:!item.isLocked&&(c.perms.has('program.edit')||(item.type==='ENTERTAINMENT'&&c.perms.has('program.edit_entertainment'))||item.responsibleId===actorId),manage:c.perms.has('program.edit')||(item.type==='ENTERTAINMENT'&&c.perms.has('program.edit_entertainment')),lock:c.perms.has('program.edit')}};
   }),conflicts:programConflicts(items),capabilities:{reorder:c.perms.has('program.edit'),create:c.perms.has('program.edit')||c.perms.has('program.edit_entertainment'),fullEdit:c.perms.has('program.edit'),propose:c.actor.role==='ADMIN'||(c.actor.role==='LEAD'&&c.admitted),decide:c.actor.role==='ADMIN'}};
  });
 }
 async candidates(actorId:string,shiftId:string,page=1,pageSize=20,search='') {
  return this.db.$transaction(async tx=>{
   const c=await this.view(tx,actorId,shiftId);
   requireRule(c.perms.has('program.edit')||c.perms.has('program.edit_entertainment'),403,'FORBIDDEN','Нет права назначать ответственного');
   const where={isOnboarded:true,accountStatus:'CONFIRMED' as const,applications:{some:{shiftId,status:'APPROVED' as const}},...(search?{OR:[{firstName:{contains:search,mode:'insensitive' as const}},{lastName:{contains:search,mode:'insensitive' as const}}]}:{})};
   const items=await tx.user.findMany({where,select:{id:true,firstName:true,lastName:true},orderBy:[{lastName:'asc'},{id:'asc'}],skip:(page-1)*pageSize,take:pageSize});
   return {items,total:await tx.user.count({where}),page,pageSize};
  });
 }
 private async references(tx:Tx,actorId:string,admin:boolean,shiftId:string,data:{responsibleId?:string|null;bankEventId?:string|null}) {
  if(data.responsibleId) requireRule(await tx.user.findFirst({where:{id:data.responsibleId,isOnboarded:true,accountStatus:'CONFIRMED',applications:{some:{shiftId,status:'APPROVED'}}}}),400,'INVALID_RESPONSIBLE','Ответственный должен быть принят на эту смену');
  if(data.bankEventId) requireRule(await tx.bankEvent.findFirst({where:{id:data.bankEventId,...(admin?{}:{OR:[{isPublic:true},{authorId:actorId}]})}}),400,'INVALID_BANK_EVENT','Мероприятие банка недоступно');
 }
 private async record(tx:Tx,actorId:string,shiftId:string,action:string,entityId:string,fields:string[]=[]) {
  await tx.auditLog.create({data:{actorId,shiftId,action,entityType:'ProgramItem',entityId,details:{fields}}});
 }
 async create(actorId:string,shiftId:string,data:z.infer<typeof programItemCreateSchema>) {
  return this.locked(actorId,shiftId,async(tx,c)=>{
   requireRule(c.perms.has('program.edit')||(data.type==='ENTERTAINMENT'&&c.perms.has('program.edit_entertainment')),403,'FORBIDDEN','Нет права добавлять этот тип мероприятий');
   requireRule(data.endTime>data.startTime,400,'INVALID_TIME','Окончание должно быть позже начала');
   await this.references(tx,actorId,c.actor.role==='ADMIN',shiftId,data);
   const item=await tx.programItem.create({data:{...data,shiftId,date:new Date(data.date+'T00:00:00Z')}});
   await this.record(tx,actorId,shiftId,'PROGRAM_ITEM_CREATED',item.id);
   return {item};
  });
 }
 async update(actorId:string,shiftId:string,itemId:string,input:z.infer<typeof programItemUpdateSchema>) {
  return this.locked(actorId,shiftId,async(tx,c)=>{
   const item=await tx.programItem.findFirst({where:{id:itemId,shiftId}});requireRule(item,404,'NOT_FOUND','Пункт программы не найден');
   const full=c.perms.has('program.edit'),manager=full||(item.type==='ENTERTAINMENT'&&c.perms.has('program.edit_entertainment'));
   const {updatedAt,...data}=input;const fields=Object.keys(data);
   requireRule(manager||item.responsibleId===actorId,403,'FORBIDDEN','Нет права изменять мероприятие');
   if(!manager) requireRule(fields.every(key=>['title','description','location','startTime','endTime','bankEventId'].includes(key)),403,'FORBIDDEN','Нет права изменять эти поля');
   if(!full&&data.type) requireRule(data.type===item.type,403,'FORBIDDEN','Нет права менять тип');
   if(data.sortOrder!==undefined) requireRule(full,403,'FORBIDDEN','Нет права менять порядок');
   requireRule(!item.isLocked,409,'PROGRAM_LOCKED','Сначала разблокируйте пункт программы');
   requireRule((data.endTime??item.endTime)>(data.startTime??item.startTime),400,'INVALID_TIME','Окончание должно быть позже начала');
   await this.references(tx,actorId,c.actor.role==='ADMIN',shiftId,data);
   const changed=await tx.programItem.updateMany({where:{id:itemId,shiftId,updatedAt:new Date(updatedAt)},data:{...data,...(data.date?{date:new Date(data.date+'T00:00:00Z')}:{}),updatedAt:new Date(Math.max(Date.now(),item.updatedAt.getTime()+1))}});
   requireRule(changed.count===1,409,'STALE_PROGRAM','Программа изменилась. Обновите список');
   await this.record(tx,actorId,shiftId,'PROGRAM_ITEM_UPDATED',itemId,fields);
   return {ok:true};
  });
 }
 async remove(actorId:string,shiftId:string,itemId:string,updatedAt:string) {
  return this.locked(actorId,shiftId,async(tx,c)=>{
   const item=await tx.programItem.findFirst({where:{id:itemId,shiftId}});requireRule(item,404,'NOT_FOUND','Пункт программы не найден');
   requireRule(c.perms.has('program.edit')||(item.type==='ENTERTAINMENT'&&c.perms.has('program.edit_entertainment')),403,'FORBIDDEN','Нет права удалять мероприятие');
   requireRule(!item.isLocked,409,'PROGRAM_LOCKED','Сначала разблокируйте пункт программы');
   const changed=await tx.programItem.deleteMany({where:{id:itemId,shiftId,updatedAt:new Date(updatedAt)}});
   requireRule(changed.count===1,409,'STALE_PROGRAM','Программа изменилась. Обновите список');
   await this.record(tx,actorId,shiftId,'PROGRAM_ITEM_DELETED',itemId);return {ok:true};
  });
 }
 async lockItem(actorId:string,shiftId:string,itemId:string,updatedAt:string,isLocked:boolean) {
  return this.locked(actorId,shiftId,async(tx,c)=>{
   requireRule(c.perms.has('program.edit'),403,'FORBIDDEN','Нет права управлять блокировкой');
   const item=await tx.programItem.findFirst({where:{id:itemId,shiftId}});requireRule(item,404,'NOT_FOUND','Пункт программы не найден');
   const changed=await tx.programItem.updateMany({where:{id:itemId,shiftId,updatedAt:new Date(updatedAt)},data:{isLocked,updatedAt:new Date(Math.max(Date.now(),item.updatedAt.getTime()+1))}});
   requireRule(changed.count===1,409,'STALE_PROGRAM','Программа изменилась. Обновите список');
   await this.record(tx,actorId,shiftId,isLocked?'PROGRAM_ITEM_LOCKED':'PROGRAM_ITEM_UNLOCKED',itemId);return {ok:true};
  });
 }
 async history(actorId:string,shiftId:string,page:number,pageSize:number) {
  return this.db.$transaction(async tx=>{
   await this.view(tx,actorId,shiftId);
   const where={shiftId,action:{in:['PROGRAM_ITEM_CREATED','PROGRAM_ITEM_UPDATED','PROGRAM_ITEM_DELETED','PROGRAM_ITEM_LOCKED','PROGRAM_ITEM_UNLOCKED','PROGRAM_REORDERED']}};
   return {items:await tx.auditLog.findMany({where,select:{id:true,action:true,entityId:true,createdAt:true,actor:{select:{firstName:true,lastName:true}}},orderBy:[{createdAt:'desc'},{id:'asc'}],skip:(page-1)*pageSize,take:pageSize}),total:await tx.auditLog.count({where}),page,pageSize};
  });
 }
 async reorder(actorId:string,shiftId:string,items:Array<{id:string;sortOrder:number;updatedAt:string}>) {
  requireRule(new Set(items.map(x=>x.id)).size===items.length,400,'DUPLICATE_ITEMS','Пункты программы повторяются');
  return this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "Shift" WHERE id = ${shiftId} FOR UPDATE`;
   const c=await this.context(tx,actorId,shiftId);
   requireRule(c.perms.has('program.edit'),403,'FORBIDDEN','Нет права изменять порядок программы');
   // All mutations acquire the same shift lock; snapshots detect stale clients.
   const existing=await tx.programItem.findMany({where:{shiftId,id:{in:items.map(x=>x.id)}}});
   requireRule(existing.length===items.length,404,'NOT_FOUND','Пункт программы не найден');
   requireRule(existing.every(x=>!x.isLocked),409,'PROGRAM_LOCKED','Пункт программы заблокирован');
   for(const item of [...items].sort((a,b)=>a.id.localeCompare(b.id))) {
    const changed=await tx.programItem.updateMany({where:{id:item.id,shiftId,isLocked:false,updatedAt:new Date(item.updatedAt)},data:{sortOrder:item.sortOrder,updatedAt:new Date(Math.max(Date.now(),new Date(item.updatedAt).getTime()+1))}});
    requireRule(changed.count===1,409,'STALE_PROGRAM','Программа изменилась. Обновите список и повторите действие');
   }
   await tx.auditLog.create({data:{actorId,shiftId,action:'PROGRAM_REORDERED',entityType:'Shift',entityId:shiftId,details:{count:items.length}}});
   return {ok:true};
  });
 }
 async propose(actorId:string,shiftId:string,text:string) {
  return this.db.$transaction(async tx=>{
   const {actor}=await this.context(tx,actorId,shiftId);
   requireRule(actor.role==='ADMIN'||actor.role==='LEAD',403,'FORBIDDEN','Предлагать изменения могут ведущие');
   if(actor.role!=='ADMIN') requireRule(await tx.application.findFirst({where:{shiftId,userId:actorId,status:'APPROVED'}}),403,'FORBIDDEN','Нет допуска на смену');
   const proposal=await tx.programProposal.create({data:{shiftId,authorId:actorId,text}});
   await tx.auditLog.create({data:{actorId,shiftId,action:'PROGRAM_PROPOSAL_CREATED',entityType:'ProgramProposal',entityId:proposal.id}});
   return {proposal};
  });
 }
 async proposals(actorId:string,shiftId:string,page:number,pageSize:number) {
  return this.db.$transaction(async tx=>{
   const {actor}=await this.context(tx,actorId,shiftId);
   // Authors may review their own decisions; only ADMIN sees other proposals.
   const where={shiftId,...(actor.role==='ADMIN'?{}:{authorId:actorId})};
   const items=await tx.programProposal.findMany({where,orderBy:[{createdAt:'desc'},{id:'asc'}],skip:(page-1)*pageSize,take:pageSize});
   return {items,total:await tx.programProposal.count({where}),page,pageSize};
  });
 }
 async decide(actorId:string,shiftId:string,proposalId:string,status:'ACCEPTED'|'REJECTED') {
  return this.db.$transaction(async tx=>{
   const {actor}=await this.context(tx,actorId,shiftId);
   requireRule(actor.role==='ADMIN',403,'FORBIDDEN','Решение принимает руководитель');
   requireRule(await tx.programProposal.findFirst({where:{id:proposalId,shiftId}}),404,'NOT_FOUND','Предложение не найдено');
   const changed=await tx.programProposal.updateMany({where:{id:proposalId,shiftId,status:'PENDING'},data:{status}});
   requireRule(changed.count===1,409,'ALREADY_DECIDED','Предложение уже рассмотрено');
   await tx.auditLog.create({data:{actorId,shiftId,action:`PROGRAM_PROPOSAL_${status}`,entityType:'ProgramProposal',entityId:proposalId}});
   return {proposal:await tx.programProposal.findUniqueOrThrow({where:{id:proposalId}})};
  });
 }
}
