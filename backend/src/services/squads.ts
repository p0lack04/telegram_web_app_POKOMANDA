import {squadDto} from './dto.js';
import {Prisma,type PrismaClient,type User} from '@prisma/client';
import {permissions,requireActive,visibleShiftWhere} from '../domain/permissions.js';
import {squadScope} from '../domain/squads.js';
import {requireRule} from '../errors.js';

const squadSelect={id:true,name:true,color:true,sortOrder:true} as const;
type Tx=Prisma.TransactionClient;
export class SquadService {
 constructor(private db:PrismaClient) {}
 private async scope(tx:Tx,actorId:string,shiftId:string) {
  const actor:User=await tx.user.findUniqueOrThrow({where:{id:actorId}});requireActive(actor);
  const shift=await tx.shift.findFirst({where:{id:shiftId,...visibleShiftWhere(actor)}});
  requireRule(shift,404,'NOT_FOUND','Смена не найдена');
  const roles=await tx.shiftRole.findMany({where:{userId:actor.id,shiftId},select:{position:true}});
  return squadScope(permissions(actor,shift,roles.map(role=>role.position)),actor.id,shiftId);
 }
 async list(actorId:string,shiftId:string,page:number,pageSize:number) {
  return this.db.$transaction(async tx=>{
   const where=await this.scope(tx,actorId,shiftId);
   requireRule(where,403,'FORBIDDEN','Просмотр отрядов недоступен');
   const items=await tx.squad.findMany({where,select:squadSelect,orderBy:[{sortOrder:'asc'},{id:'asc'}],skip:(page-1)*pageSize,take:pageSize});
   return {items:items.map(squadDto),total:await tx.squad.count({where}),page,pageSize};
  });
 }
 async detail(actorId:string,shiftId:string,squadId:string) {
  return this.db.$transaction(async tx=>{
   const where=await this.scope(tx,actorId,shiftId);
   requireRule(where,404,'NOT_FOUND','Отряд не найден');
   const squad=await tx.squad.findFirst({where:{...where,id:squadId},select:squadSelect});
   requireRule(squad,404,'NOT_FOUND','Отряд не найден');return {squad:squadDto(squad)};
  });
 }
}
