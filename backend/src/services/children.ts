import {Prisma,type PrismaClient} from '@prisma/client';
import {z} from 'zod';
import {permissions,requireActive,visibleShiftWhere} from '../domain/permissions.js';
import {squadScope} from '../domain/squads.js';
import {childCreateSchema,childPlacementSchema} from '../domain/children.js';
import {requireRule} from '../errors.js';

type Tx=Prisma.TransactionClient;
const select={id:true,squadId:true,firstName:true,lastName:true,middleName:true,birthDate:true,building:true,room:true} as const;
export class ChildrenService {
 constructor(private db:PrismaClient) {}
 private async scope(tx:Tx,actorId:string,shiftId:string,squadId:string,management=false) {
  const actor=await tx.user.findUniqueOrThrow({where:{id:actorId}});requireActive(actor);
  const shift=await tx.shift.findFirst({where:{id:shiftId,...visibleShiftWhere(actor)}});requireRule(shift,404,'NOT_FOUND','Смена не найдена');
  const roles=await tx.shiftRole.findMany({where:{userId:actorId,shiftId},select:{position:true}});
  const granted=permissions(actor,shift,roles.map(r=>r.position));
  const globalManagement=actor.role==='ADMIN'||roles.some(r=>['Руководитель','Заместитель руководителя'].includes(r.position));
  const managedScope:Prisma.SquadWhereInput=globalManagement?{shiftId}:{shiftId,OR:[{members:{some:{userId:actorId,shiftId}}},{roles:{some:{userId:actorId,shiftId}}}]};
  const scope=management?managedScope:squadScope(granted,actorId,shiftId);
  requireRule(scope && await tx.squad.findFirst({where:{...scope,id:squadId},select:{id:true}}),404,'NOT_FOUND','Отряд не найден');
  return granted;
 }
 private async locked<T>(shiftId:string,fn:(tx:Tx)=>Promise<T>) {
  return this.db.$transaction(async tx=>{await tx.$queryRaw`SELECT "id" FROM "Shift" WHERE "id" = ${shiftId} FOR UPDATE`;return fn(tx);});
 }
  async list(actorId:string,shiftId:string,squadId:string,page:number,pageSize:number) {
  return this.db.$transaction(async tx=>{
   await this.scope(tx,actorId,shiftId,squadId);
   const where={shiftId,squadId,memberType:'CHILD' as const};
   const items=await tx.squadMember.findMany({where,select,orderBy:[{lastName:'asc'},{firstName:'asc'},{id:'asc'}],skip:(page-1)*pageSize,take:pageSize});
   return {items,total:await tx.squadMember.count({where}),page,pageSize};
  });
  }
  async listShift(actorId:string,shiftId:string,page:number,pageSize:number) {
   return this.db.$transaction(async tx=>{
    const actor=await tx.user.findUniqueOrThrow({where:{id:actorId}});requireActive(actor);
    const shift=await tx.shift.findFirst({where:{id:shiftId,...visibleShiftWhere(actor)}});requireRule(shift,404,'NOT_FOUND','Смена не найдена');
    const roles=await tx.shiftRole.findMany({where:{userId:actorId,shiftId},select:{position:true}});
    const scope=squadScope(permissions(actor,shift,roles.map(r=>r.position)),actorId,shiftId);requireRule(scope,403,'FORBIDDEN','Просмотр детей недоступен');
    const where={shiftId,memberType:'CHILD' as const,squad:scope};
    const items=await tx.squadMember.findMany({where,select,orderBy:[{lastName:'asc'},{firstName:'asc'},{id:'asc'}],skip:(page-1)*pageSize,take:pageSize});
    return {items,total:await tx.squadMember.count({where}),page,pageSize};
   });
  }
 async detail(actorId:string,shiftId:string,squadId:string,memberId:string) {
  return this.db.$transaction(async tx=>{
   await this.scope(tx,actorId,shiftId,squadId);
   const member=await tx.squadMember.findFirst({where:{id:memberId,shiftId,squadId,memberType:'CHILD'},select});
   requireRule(member,404,'NOT_FOUND','Участник не найден');return {member};
  });
 }
 async create(actorId:string,shiftId:string,squadId:string,body:z.infer<typeof childCreateSchema>) {
  return this.locked(shiftId,async tx=>{
   const granted=await this.scope(tx,actorId,shiftId,squadId,true);requireRule(granted.has('squad.manage'),403,'FORBIDDEN','Управление отрядом недоступно');
   const member=await tx.squadMember.create({data:{shiftId,squadId,memberType:'CHILD',firstName:body.firstName,lastName:body.lastName,middleName:body.middleName??null,birthDate:new Date(body.birthDate+'T00:00:00Z')},select});
   await tx.auditLog.create({data:{actorId,shiftId,action:'CHILD_CREATED',entityType:'SquadMember',entityId:member.id}});return {member};
  });
 }
 async placement(actorId:string,shiftId:string,squadId:string,memberId:string,body:z.infer<typeof childPlacementSchema>) {
  return this.locked(shiftId,async tx=>{
   const granted=await this.scope(tx,actorId,shiftId,squadId);requireRule(granted.has('participants.edit_room'),403,'FORBIDDEN','Редактирование расселения недоступно');
   const member=await tx.squadMember.findFirst({where:{id:memberId,shiftId,squadId,memberType:'CHILD'},select});requireRule(member,404,'NOT_FOUND','Участник не найден');
   if(body.squadId)await this.scope(tx,actorId,shiftId,body.squadId);
   const data={...(body.squadId!==undefined&&body.squadId!==member.squadId?{squadId:body.squadId}:{}),...(body.building!==undefined&&body.building!==member.building?{building:body.building}:{}),...(body.room!==undefined&&body.room!==member.room?{room:body.room}:{})};
   if(!Object.keys(data).length)return {member};
   const updated=await tx.squadMember.update({where:{id:memberId},data,select});
   await tx.auditLog.create({data:{actorId,shiftId,action:'CHILD_PLACEMENT_UPDATED',entityType:'SquadMember',entityId:memberId,details:{fields:Object.keys(data)}}});return {member:updated};
  });
 }
}
