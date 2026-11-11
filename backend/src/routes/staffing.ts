import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {PrismaClient,User} from '@prisma/client';
import {z} from 'zod';
import {StaffingService} from '../services/staffing.js';
import {applicationCreateSchema,applicationDecisionSchema,idParam,pagination,positionSchema,recruitmentSchema,searchQuery} from '../domain/schemas.js';

export function registerStaffingRoutes(app:FastifyInstance,db:PrismaClient,authenticate:(request:FastifyRequest)=>Promise<User>) {
 const service=new StaffingService(db);
 app.get('/api/shifts/:id/staffing',async request=>service.metadata((await authenticate(request)).id,idParam.parse(request.params).id));
 app.get('/api/shifts/:id/applications',async request=>{const actor=await authenticate(request);const {id}=idParam.parse(request.params);const {page,pageSize}=pagination.parse(request.query);return service.applications(actor.id,id,page,pageSize);});
 app.get('/api/me/applications',async request=>{const actor=await authenticate(request);const {page,pageSize}=pagination.parse(request.query);return service.applications(actor.id,undefined,page,pageSize);});
 app.post('/api/shifts/:id/applications',async(request,reply)=>{const actor=await authenticate(request);const {id}=idParam.parse(request.params);const {type}=applicationCreateSchema.parse(request.body);const result=await service.submit(actor.id,id,type);reply.code(201);return result;});
 app.patch('/api/applications/:id',async request=>{const actor=await authenticate(request);const {id}=idParam.parse(request.params);return service.decide(actor.id,id,applicationDecisionSchema.parse(request.body));});
 app.patch('/api/shifts/:id/recruitment',async request=>{const actor=await authenticate(request);const {id}=idParam.parse(request.params);return service.recruitment(actor.id,id,recruitmentSchema.parse(request.body));});
 app.get('/api/shifts/:id/staff-candidates',async request=>{const actor=await authenticate(request);const {id}=idParam.parse(request.params);const {search,page,pageSize}=searchQuery.parse(request.query);return service.candidates(actor.id,id,search,page,pageSize);});
 app.get('/api/shifts/:id/staff',async request=>{const actor=await authenticate(request);const {id}=idParam.parse(request.params);const {page,pageSize}=pagination.parse(request.query);return service.staff(actor.id,id,page,pageSize);});
 app.post('/api/shifts/:id/staff',async(request,reply)=>{const actor=await authenticate(request);const {id}=idParam.parse(request.params);const {userId}=z.object({userId:z.string().min(1).max(100)}).strict().parse(request.body);const result=await service.addStaff(actor.id,id,userId);reply.code(201);return result;});
 app.get('/api/shifts/:id/roles',async request=>{const actor=await authenticate(request);const {id}=idParam.parse(request.params);const {page,pageSize}=pagination.parse(request.query);return service.assignments(actor.id,id,page,pageSize);});
 app.get('/api/me/assignments',async request=>{const actor=await authenticate(request);const {page,pageSize}=pagination.parse(request.query);return service.assignments(actor.id,undefined,page,pageSize);});
 app.post('/api/shifts/:id/roles',async(request,reply)=>{const actor=await authenticate(request);const {id}=idParam.parse(request.params);const result=await service.assign(actor.id,id,positionSchema.parse(request.body));reply.code(201);return result;});
 app.delete('/api/shifts/:id/roles/:roleId',async(request,reply)=>{const actor=await authenticate(request);const {id,roleId}=z.object({id:z.string().min(1).max(100),roleId:z.string().min(1).max(100)}).strict().parse(request.params);z.object({}).strict().parse(request.body??{});await service.removeAssignment(actor.id,id,roleId);reply.code(204).send();});
 app.get('/api/shifts/:id/staffing-history',async request=>{const actor=await authenticate(request);const {id}=idParam.parse(request.params);const {page,pageSize}=pagination.parse(request.query);return service.history(actor.id,id,page,pageSize);});
 app.get('/api/me/notifications',async request=>{const actor=await authenticate(request);const {page,pageSize}=pagination.parse(request.query);return service.notifications(actor.id,page,pageSize);});
 app.post('/api/me/notifications/:id/read',async request=>{const actor=await authenticate(request);const {id}=idParam.parse(request.params);z.object({}).strict().parse(request.body??{});return service.readNotification(actor.id,id);});
}
