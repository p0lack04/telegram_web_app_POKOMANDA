import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {PrismaClient,User} from '@prisma/client';
import {z} from 'zod';
import {bankEventCreateSchema,bankEventUpdateSchema,idParam,dateOnly,pagination,programItemCreateSchema,programItemUpdateSchema,programProposalCreateSchema,programProposalDecisionSchema,programReorderSchema,searchQuery} from '../domain/schemas.js';
import {requireActive} from '../domain/permissions.js';
import {requireRule} from '../errors.js';
import {ProgramWorkflowService} from '../services/program-workflow.js';
const shiftParam=z.object({id:z.string().min(1).max(100)}).strict();
export function registerProgramBankRoutes(app:FastifyInstance,db:PrismaClient,authenticate:(r:FastifyRequest)=>Promise<User>) {
 app.get('/api/bank-events',async req=>{const actor=await authenticate(req);requireActive(actor);const q=searchQuery.extend({category:z.enum(['FIVE_MIN','ICEBREAKER','EDUCATIONAL','ENTERTAINMENT']).optional(),ageGroup:z.string().trim().max(100).optional()}).parse(req.query);const scope=actor.role==='ADMIN'?{}:{OR:[{isPublic:true},{authorId:actor.id}]};const where={AND:[scope],...(q.search?{OR:[{title:{contains:q.search,mode:'insensitive' as const}},{description:{contains:q.search,mode:'insensitive' as const}},{tags:{has:q.search}}]}:{}),...(q.category?{category:q.category}:{}),...(q.ageGroup?{ageGroup:{contains:q.ageGroup,mode:'insensitive' as const}}:{})};const [items,total]=await db.$transaction([db.bankEvent.findMany({where,orderBy:{createdAt:'desc'},skip:(q.page-1)*q.pageSize,take:q.pageSize,select:{id:true,title:true,description:true,category:true,ageGroup:true,duration:true,materials:true,tags:true,isPublic:true,authorId:true,createdAt:true,updatedAt:true}}),db.bankEvent.count({where})]);return {items:items.map(item=>({...item,capabilities:{edit:actor.role==="ADMIN"||item.authorId===actor.id}})),total,page:q.page,pageSize:q.pageSize};});
 app.get('/api/bank-events/:id',async req=>{const actor=await authenticate(req);requireActive(actor);const {id}=idParam.parse(req.params);const event=await db.bankEvent.findFirst({where:{id,...(actor.role==='ADMIN'?{}:{OR:[{isPublic:true},{authorId:actor.id}]})},include:{files:{where:{deletedAt:null},select:{id:true,fileName:true,fileType:true,mimeType:true,fileSize:true,scanStatus:true,createdAt:true}}}});requireRule(event,404,'NOT_FOUND','Мероприятие не найдено');return {event};});
 app.post('/api/bank-events',async req=>{const actor=await authenticate(req);requireActive(actor);const data=bankEventCreateSchema.parse(req.body);const event=await db.$transaction(async tx=>{const e=await tx.bankEvent.create({data:{...data,description:data.description??null,ageGroup:data.ageGroup??null,duration:data.duration??null,materials:data.materials??null,authorId:actor.id}});await tx.auditLog.create({data:{actorId:actor.id,action:'BANK_EVENT_CREATED',entityType:'BankEvent',entityId:e.id}});return e;});return {event};});
 app.patch('/api/bank-events/:id',async req=>{
  const identity=await authenticate(req);const {id}=idParam.parse(req.params);const data=bankEventUpdateSchema.parse(req.body);
  const event=await db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT "id" FROM "BankEvent" WHERE "id" = ${id} FOR UPDATE`;
   const actor=await tx.user.findUniqueOrThrow({where:{id:identity.id}});requireActive(actor);
   const current=await tx.bankEvent.findFirst({where:{id,...(actor.role==='ADMIN'?{}:{OR:[{isPublic:true},{authorId:actor.id}]})},select:{authorId:true}});
   requireRule(current,404,'NOT_FOUND','Мероприятие не найдено');requireRule(current.authorId===actor.id||actor.role==='ADMIN',403,'FORBIDDEN','Недостаточно прав');
   const e=await tx.bankEvent.update({where:{id},data});await tx.auditLog.create({data:{actorId:actor.id,action:'BANK_EVENT_UPDATED',entityType:'BankEvent',entityId:id,details:{fields:Object.keys(data)}}});return e;
  });return {event};
 });

 const workflow=new ProgramWorkflowService(db);
 const itemParams=z.object({id:z.string().min(1).max(100),itemId:z.string().min(1).max(100)}).strict();
 app.get('/api/shifts/:id/program',async req=>{const actor=await authenticate(req);const {id}=shiftParam.parse(req.params);const {date}=z.object({date:dateOnly.optional()}).strict().parse(req.query);return workflow.list(actor.id,id,date);});
 app.post('/api/shifts/:id/program',async req=>{const actor=await authenticate(req);const {id}=shiftParam.parse(req.params);return workflow.create(actor.id,id,programItemCreateSchema.parse(req.body));});
 app.patch('/api/shifts/:id/program/:itemId',async req=>{const actor=await authenticate(req);const {id,itemId}=itemParams.parse(req.params);return workflow.update(actor.id,id,itemId,programItemUpdateSchema.parse(req.body));});
 app.delete('/api/shifts/:id/program/:itemId',async req=>{const actor=await authenticate(req);const {id,itemId}=itemParams.parse(req.params);const {updatedAt}=z.object({updatedAt:z.string().datetime()}).strict().parse(req.body);return workflow.remove(actor.id,id,itemId,updatedAt);});
 app.patch('/api/shifts/:id/program/:itemId/lock',async req=>{const actor=await authenticate(req);const {id,itemId}=itemParams.parse(req.params);const {updatedAt,isLocked}=z.object({updatedAt:z.string().datetime(),isLocked:z.boolean()}).strict().parse(req.body);return workflow.lockItem(actor.id,id,itemId,updatedAt,isLocked);});
 app.get('/api/shifts/:id/program-candidates',async req=>{const actor=await authenticate(req);const {id}=shiftParam.parse(req.params);const {page,pageSize,search}=searchQuery.parse(req.query);return workflow.candidates(actor.id,id,page,pageSize,search);});
 app.get('/api/shifts/:id/program-history',async req=>{const actor=await authenticate(req);const {id}=shiftParam.parse(req.params);const {page,pageSize}=pagination.parse(req.query);return workflow.history(actor.id,id,page,pageSize);});
 app.patch('/api/shifts/:id/program/reorder',async req=>{const actor=await authenticate(req);const {id}=shiftParam.parse(req.params);const {items}=programReorderSchema.parse(req.body);return workflow.reorder(actor.id,id,items);});
 app.post('/api/shifts/:id/program-proposals',async req=>{const actor=await authenticate(req);const {id}=shiftParam.parse(req.params);const {text}=programProposalCreateSchema.parse(req.body);return workflow.propose(actor.id,id,text);});
 app.get('/api/shifts/:id/program-proposals',async req=>{const actor=await authenticate(req);const {id}=shiftParam.parse(req.params);const {page,pageSize}=pagination.parse(req.query);return workflow.proposals(actor.id,id,page,pageSize);});
 app.patch('/api/shifts/:id/program-proposals/:proposalId',async req=>{const actor=await authenticate(req);const {id,proposalId}=z.object({id:z.string().min(1).max(100),proposalId:z.string().min(1).max(100)}).strict().parse(req.params);const {status}=programProposalDecisionSchema.parse(req.body);return workflow.decide(actor.id,id,proposalId,status);});
}
