import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {PrismaClient,User} from '@prisma/client';
import {z} from 'zod';
import {idParam,pagination,searchQuery,dateOnly,squadCreateSchema,squadUpdateSchema,staffCreateSchema,memberMoveSchema,memberSnapshotSchema,paymentSchema,checkinSchema,dailyMarkSchema} from '../domain/schemas.js';
import {SquadService} from '../services/squads.js';
const params=z.object({id:z.string().min(1).max(100),squadId:z.string().min(1).max(100)}).strict();
export function registerSquadRoutes(app:FastifyInstance,db:PrismaClient,authenticate:(request:FastifyRequest)=>Promise<User>) {
 const service=new SquadService(db);
 app.get('/api/shifts/:id/squads/:squadId/staff-candidates',async req=>{const a=await authenticate(req);const p=params.parse(req.params);const q=searchQuery.parse(req.query);return service.candidates(a.id,p.id,p.squadId,q.search,q.page,q.pageSize);});
 app.get('/api/shifts/:id/squads/:squadId/history',async req=>{const a=await authenticate(req);const p=params.parse(req.params);const q=pagination.parse(req.query);return service.history(a.id,p.id,p.squadId,q.page,q.pageSize);});
 app.get('/api/shifts/:id/squad-members/:memberId/status',async req=>{const a=await authenticate(req);const p=z.object({id:z.string().min(1).max(100),memberId:z.string().min(1).max(100)}).strict().parse(req.params);z.object({}).strict().parse(req.query);return service.status(a.id,p.id,p.memberId);});
 app.get('/api/shifts/:id/squads',async req=>{const a=await authenticate(req);const {id}=idParam.parse(req.params);const q=pagination.parse(req.query);return service.list(a.id,id,q.page,q.pageSize);});
 app.get('/api/shifts/:id/squads/:squadId',async req=>{const a=await authenticate(req);const p=params.parse(req.params);z.object({}).strict().parse(req.query);return service.detail(a.id,p.id,p.squadId);});
 app.post('/api/shifts/:id/squads',async(req,reply)=>{const a=await authenticate(req);const {id}=idParam.parse(req.params);const out=await service.create(a.id,id,squadCreateSchema.parse(req.body));reply.code(201);return out;});
 app.patch('/api/shifts/:id/squads/:squadId',async req=>{const a=await authenticate(req);const p=params.parse(req.params);return service.update(a.id,p.id,p.squadId,squadUpdateSchema.parse(req.body));});
 app.delete('/api/shifts/:id/squads/:squadId',async req=>{const a=await authenticate(req);const p=params.parse(req.params);return service.remove(a.id,p.id,p.squadId);});
 app.get('/api/shifts/:id/squads/:squadId/staff',async req=>{const a=await authenticate(req);const p=params.parse(req.params);const q=pagination.parse(req.query);return service.staff(a.id,p.id,p.squadId,q.page,q.pageSize);});
 app.post('/api/shifts/:id/squads/:squadId/staff',async(req,reply)=>{const a=await authenticate(req);const p=params.parse(req.params);const out=await service.addStaff(a.id,p.id,p.squadId,staffCreateSchema.parse(req.body));reply.code(201);return out;});
 app.get('/api/shifts/:id/squads/:squadId/members',async req=>{const a=await authenticate(req);const p=params.parse(req.params);const q=pagination.parse(req.query);return service.staff(a.id,p.id,p.squadId,q.page,q.pageSize);});
 app.post('/api/shifts/:id/squads/:squadId/members',async(req,reply)=>{const a=await authenticate(req);const p=params.parse(req.params);const out=await service.addStaff(a.id,p.id,p.squadId,staffCreateSchema.parse(req.body));reply.code(201);return out;});
 app.patch('/api/shifts/:id/squad-members/:memberId',async req=>{const a=await authenticate(req);const p=z.object({id:z.string(),memberId:z.string()}).parse(req.params);const body=memberMoveSchema.parse(req.body);return service.moveStaff(a.id,p.id,p.memberId,body.squadId,body);});
 app.delete('/api/shifts/:id/squad-members/:memberId',async req=>{const a=await authenticate(req);const p=z.object({id:z.string(),memberId:z.string()}).parse(req.params);return service.removeStaff(a.id,p.id,p.memberId,memberSnapshotSchema.parse(req.body??{}));});
 app.patch('/api/shifts/:id/squad-members/:memberId/payment',async req=>{const a=await authenticate(req);const p=z.object({id:z.string(),memberId:z.string()}).parse(req.params);return service.updatePayment(a.id,p.id,p.memberId,paymentSchema.parse(req.body));});
 app.patch('/api/shifts/:id/squad-members/:memberId/checkin',async req=>{const a=await authenticate(req);const p=z.object({id:z.string(),memberId:z.string()}).parse(req.params);const body=checkinSchema.parse(req.body);return service.updateCheckin(a.id,p.id,p.memberId,body.checkinStatus,body.updatedAt);});
 app.get('/api/shifts/:id/squad-members/:memberId/daily-marks',async req=>{const a=await authenticate(req);const p=z.object({id:z.string(),memberId:z.string()}).parse(req.params);const q=pagination.extend({date:dateOnly.optional()}).strict().parse(req.query);return service.marks(a.id,p.id,p.memberId,q.page,q.pageSize,q.date);});
 app.post('/api/shifts/:id/squad-members/:memberId/daily-marks',async(req,reply)=>{const a=await authenticate(req);const p=z.object({id:z.string(),memberId:z.string()}).parse(req.params);const out=await service.setMark(a.id,p.id,p.memberId,dailyMarkSchema.parse(req.body));reply.code(201);return out;});
}

