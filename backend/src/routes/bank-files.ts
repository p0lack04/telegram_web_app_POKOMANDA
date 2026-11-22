import multipart from '@fastify/multipart';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {PrismaClient,User} from '@prisma/client';
import {z} from 'zod';
import {pagination} from '../domain/schemas.js';
import {MEDIA_LIMIT} from '../domain/bank-files.js';
import {BankFilesService} from '../services/bank-files.js';
import type {FileDependencies} from '../integrations/bank-files.js';
import {requireRule} from '../errors.js';
const eventParams=z.object({eventId:z.string().min(1).max(100)}).strict();
const fileParams=eventParams.extend({fileId:z.string().min(1).max(100)});
export function registerBankFileRoutes(app:FastifyInstance,db:PrismaClient,authenticate:(r:FastifyRequest)=>Promise<User>,dependencies?:FileDependencies){
 const service=new BankFilesService(db,dependencies);
 void app.register(async scope=>{
  await scope.register(multipart,{limits:{fileSize:MEDIA_LIMIT,files:1,fields:0,parts:1},throwFileSizeLimit:true});
  scope.get('/api/bank-events/:eventId/files',async req=>{const actor=await authenticate(req);const {eventId}=eventParams.parse(req.params);const {page,pageSize}=pagination.parse(req.query);return service.list(actor.id,eventId,page,pageSize);});
  scope.post('/api/bank-events/:eventId/files',{bodyLimit:MEDIA_LIMIT+65536,preValidation:async req=>{const actor=await authenticate(req);const {eventId}=eventParams.parse(req.params);await service.authorize(actor.id,eventId,true);}},async(req,reply)=>{
   const actor=await authenticate(req);const {eventId}=eventParams.parse(req.params);z.object({}).strict().parse(req.query);
   const requestId=z.uuid().parse(req.headers['idempotency-key']);const part=await req.file();requireRule(part&&part.fieldname==='file',400,'FILE_REQUIRED','Выберите один файл');const bytes=await part.toBuffer();requireRule(!part.file.truncated,413,'FILE_TOO_LARGE','Файл слишком большой');
   const result=await service.upload(actor.id,eventId,requestId,part.filename,part.mimetype,bytes);reply.code(201);return result;
  });
  scope.post('/api/bank-events/:eventId/files/:fileId/scan',async req=>{const actor=await authenticate(req);const {eventId,fileId}=fileParams.parse(req.params);z.object({}).strict().parse(req.body??{});return service.scan(actor.id,eventId,fileId);});
  scope.get('/api/bank-events/:eventId/files/:fileId/download',async(req,reply)=>{const actor=await authenticate(req);const {eventId,fileId}=fileParams.parse(req.params);z.object({}).strict().parse(req.query);const out=await service.download(actor.id,eventId,fileId);return reply.header('Content-Type',out.mimeType).header('Content-Disposition',`attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(out.fileName).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16))}`).header('X-Content-Type-Options','nosniff').header('Content-Security-Policy',"default-src 'none'; sandbox").send(out.bytes);});
  scope.delete('/api/bank-events/:eventId/files/:fileId',async req=>{const actor=await authenticate(req);const {eventId,fileId}=fileParams.parse(req.params);z.object({}).strict().parse(req.body??{});return service.remove(actor.id,eventId,fileId);});
 });
}
