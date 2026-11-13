import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {PrismaClient,User} from '@prisma/client';
import {z} from 'zod';
import {pagination} from '../domain/schemas.js';
import {childCreateSchema,childParams,childPlacementSchema,childSquadParams} from '../domain/children.js';
import {ChildrenService} from '../services/children.js';

export function registerChildrenRoutes(app:FastifyInstance,db:PrismaClient,authenticate:(request:FastifyRequest)=>Promise<User>) {
 const service=new ChildrenService(db);
  app.get('/api/shifts/:id/children',async request=>{const actor=await authenticate(request);const {id}=z.object({id:z.string().min(1).max(100)}).strict().parse(request.params);const {page,pageSize}=pagination.parse(request.query);return service.listShift(actor.id,id,page,pageSize);});
 const root='/api/shifts/:id/squads/:squadId/children';
 app.get(root,async request=>{const actor=await authenticate(request);const {id,squadId}=childSquadParams.parse(request.params);const {page,pageSize}=pagination.parse(request.query);return service.list(actor.id,id,squadId,page,pageSize);});
 app.get(`${root}/:memberId`,async request=>{const actor=await authenticate(request);const {id,squadId,memberId}=childParams.parse(request.params);z.object({}).strict().parse(request.query);return service.detail(actor.id,id,squadId,memberId);});
 app.post(root,async(request,reply)=>{const actor=await authenticate(request);const {id,squadId}=childSquadParams.parse(request.params);z.object({}).strict().parse(request.query);const result=await service.create(actor.id,id,squadId,childCreateSchema.parse(request.body));reply.code(201);return result;});
 app.patch(`${root}/:memberId`,async request=>{const actor=await authenticate(request);const {id,squadId,memberId}=childParams.parse(request.params);z.object({}).strict().parse(request.query);return service.placement(actor.id,id,squadId,memberId,childPlacementSchema.parse(request.body));});
}
