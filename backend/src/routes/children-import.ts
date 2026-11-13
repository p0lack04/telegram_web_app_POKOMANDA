import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {PrismaClient,User} from '@prisma/client';
import {z} from 'zod';
import {createHash} from 'node:crypto';
import {idParam} from '../domain/schemas.js';
import {ChildrenImportService,cleanupChildPreviews} from '../services/children-import.js';
import {parseChildrenXlsx} from '../domain/xlsx-children.js';
import {requireRule} from '../errors.js';
const params=idParam.extend({jobId:z.string().min(1).max(100)}).strict();
const revision=z.number().int().positive();
export function registerChildrenImportRoutes(app:FastifyInstance,db:PrismaClient,authenticate:(request:FastifyRequest)=>Promise<User>){
 const service=new ChildrenImportService(db);
 const root='/api/shifts/:id/children/import';
 // Raw body, no temporary disk upload. The global default JSON limit is unchanged.
 app.addContentTypeParser('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',{parseAs:'buffer',bodyLimit:2*1024*1024},(_request,body,done)=>done(null,body));
 app.post(`${root}/preview`,{bodyLimit:2*1024*1024,preParsing: async (request, _reply, payload) => {
  const actor = await authenticate(request);
  const { id } = idParam.parse(request.params);
  await service.authorize(actor.id, id);
  return payload;
}},async(request,reply)=>{
  const actor=await authenticate(request);const {id}=idParam.parse(request.params);z.object({}).strict().parse(request.query);
  requireRule(Buffer.isBuffer(request.body),400,'XLSX_REQUIRED','Ожидается файл XLSX');
  const rows=await parseChildrenXlsx(request.body);
  const result=await service.preview(actor.id,id,createHash('sha256').update(request.body).digest('hex'),rows);
  reply.code(201);return result;
 });
 app.get(`${root}/:jobId`,async request=>{const actor=await authenticate(request);const {id,jobId}=params.parse(request.params);z.object({}).strict().parse(request.query);return service.get(actor.id,id,jobId);});
 app.post(`${root}/:jobId/mapping`,async request=>{
  const actor=await authenticate(request);const {id,jobId}=params.parse(request.params);z.object({}).strict().parse(request.query);
  const body=z.object({revision,choices:z.array(z.object({rowNumber:z.number().int().min(2),action:z.enum(['new','skip','match']),memberId:z.string().min(1).max(100).optional()}).strict().refine(c=>c.action==='match'?!!c.memberId:c.memberId===undefined)).max(1000)}).strict().parse(request.body);
  return service.mapping(actor.id,id,jobId,body.revision,body.choices);
 });
 app.post(`${root}/:jobId/commit`,async request=>{
  const actor=await authenticate(request);const {id,jobId}=params.parse(request.params);z.object({}).strict().parse(request.query);
  const body=z.object({revision,confirmed:z.literal(true)}).strict().parse(request.body);
  return service.commit(actor.id,id,jobId,body.revision);
 });
 let timer:ReturnType<typeof setInterval>|undefined;
 app.addHook('onReady',async()=>{await cleanupChildPreviews(db);timer=setInterval(()=>{void cleanupChildPreviews(db).catch(()=>{/* no PII in operational logs */});},60000);timer.unref();});
 app.addHook('onClose',async()=>{if(timer)clearInterval(timer);});
}
