import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {PrismaClient,User} from '@prisma/client';
import {z} from 'zod';
import {idParam,pagination} from '../domain/schemas.js';
import {SquadService} from '../services/squads.js';

const detailParams=z.object({id:z.string().min(1).max(100),squadId:z.string().min(1).max(100)}).strict();
export function registerSquadRoutes(app:FastifyInstance,db:PrismaClient,authenticate:(request:FastifyRequest)=>Promise<User>) {
 const service=new SquadService(db);
 app.get('/api/shifts/:id/squads',async request=>{const actor=await authenticate(request);const {id}=idParam.parse(request.params);const {page,pageSize}=pagination.parse(request.query);return service.list(actor.id,id,page,pageSize);});
 app.get('/api/shifts/:id/squads/:squadId',async request=>{const actor=await authenticate(request);const {id,squadId}=detailParams.parse(request.params);z.object({}).strict().parse(request.query);return service.detail(actor.id,id,squadId);});
}
