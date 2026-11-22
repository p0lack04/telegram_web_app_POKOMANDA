import {randomUUID} from 'node:crypto';
import {Prisma,type PrismaClient} from '@prisma/client';
import {permissions,requireActive,visibleShiftWhere} from '../domain/permissions.js';
import {checksum,validateBankFile} from '../domain/bank-files.js';
import type {FileDependencies} from '../integrations/bank-files.js';
import {AppError,requireRule} from '../errors.js';

const select={id:true,fileName:true,fileType:true,mimeType:true,fileSize:true,scanStatus:true,createdAt:true} as const;
type Tx=Prisma.TransactionClient;
export class BankFilesService {
 constructor(private db:PrismaClient,private dependencies?:FileDependencies){}
 private available(){requireRule(this.dependencies,503,'FILES_UNAVAILABLE','Файловое хранилище и проверка пока недоступны');return this.dependencies;}
 async access(tx:Tx,actorId:string,eventId:string,write=false){
  const actor=await tx.user.findUniqueOrThrow({where:{id:actorId}});requireActive(actor);
  const event=await tx.bankEvent.findFirst({where:{id:eventId,...(actor.role==='ADMIN'?{}:{OR:[{isPublic:true},{authorId:actorId}]})},select:{id:true,authorId:true}});
  requireRule(event,404,'NOT_FOUND','Мероприятие не найдено');
  let upload=actor.role==='ADMIN';
  if(!upload&&event.authorId===actorId){
   const roles=await tx.shiftRole.findMany({where:{userId:actorId,shift:visibleShiftWhere(actor)},select:{position:true,shift:true}});
   upload=roles.some(role=>permissions(actor,role.shift,[role.position]).has('bank.upload_files'));
  }
  if(write)requireRule(upload,403,'FORBIDDEN','Загрузка и удаление требуют права работы с файлами и редактирования мероприятия');
  return {upload};
 }
 async authorize(actorId:string,eventId:string,write=false){return this.db.$transaction(tx=>this.access(tx,actorId,eventId,write));}
 async list(actorId:string,eventId:string,page:number,pageSize:number){return this.db.$transaction(async tx=>{
  const capabilities=await this.access(tx,actorId,eventId);const where={bankEventId:eventId,deletedAt:null};
  return {items:await tx.bankEventFile.findMany({where,select,orderBy:[{createdAt:'desc'},{id:'asc'}],skip:(page-1)*pageSize,take:pageSize}),total:await tx.bankEventFile.count({where}),page,pageSize,capabilities:{upload:capabilities.upload&&!!this.dependencies,delete:capabilities.upload,retry:capabilities.upload&&!!this.dependencies},available:!!this.dependencies};
 });}
 async upload(actorId:string,eventId:string,requestId:string,name:string,mime:string,bytes:Buffer){
  await this.authorize(actorId,eventId,true);const dependencies=this.available();const data=await validateBankFile(name,mime,bytes);
  const requestKey=`${actorId}:${eventId}:${requestId}`;
  const file=await this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT "id" FROM "BankEvent" WHERE "id" = ${eventId} FOR UPDATE`;
   await this.access(tx,actorId,eventId,true);
   const existing=await tx.bankEventFile.findUnique({where:{requestKey}});
   if(existing){requireRule(!existing.deletedAt&&existing.checksum===data.checksum&&existing.fileName===data.fileName&&existing.mimeType===data.mimeType,409,'UPLOAD_CONFLICT','Ключ загрузки уже использован. Выберите файл заново');return existing;}
   const {extension,...metadata}=data;
   const created=await tx.bankEventFile.create({data:{...metadata,bankEventId:eventId,uploadedById:actorId,storageKey:`bank/${randomUUID()}.${extension}`,requestKey}});
   await tx.auditLog.create({data:{actorId,action:'BANK_FILE_UPLOADED',entityType:'BankEventFile',entityId:created.id,details:{bankEventId:eventId}}});return created;
  });
  if(file.scanStatus==='CLEAN'||file.scanStatus==='INFECTED')return {file:await this.db.bankEventFile.findUniqueOrThrow({where:{id:file.id},select})};
  try{await dependencies.storage.put(file.storageKey,bytes,file.mimeType);}catch{await this.finishScan(file.id,actorId,eventId,'ERROR');throw new AppError(503,'STORAGE_UNAVAILABLE','Не удалось сохранить файл. Повторите загрузку');}
  return this.scan(actorId,eventId,file.id);
 }
 private async finishScan(fileId:string,actorId:string,eventId:string,status:'CLEAN'|'INFECTED'|'ERROR'){
  return this.db.$transaction(async tx=>{
   const changed=await tx.bankEventFile.updateMany({where:{id:fileId,deletedAt:null,scanStatus:{in:['PENDING','ERROR']}},data:{scanStatus:status}});
   if(changed.count)await tx.auditLog.create({data:{actorId,action:'BANK_FILE_SCANNED',entityType:'BankEventFile',entityId:fileId,details:{bankEventId:eventId,scanStatus:status}}});
  });
 }
 async scan(actorId:string,eventId:string,fileId:string){
  await this.authorize(actorId,eventId,true);const dependencies=this.available();
  const file=await this.db.bankEventFile.findFirst({where:{id:fileId,bankEventId:eventId,deletedAt:null}});requireRule(file,404,'NOT_FOUND','Файл не найден');
  if(file.scanStatus==='CLEAN'||file.scanStatus==='INFECTED')return {file:await this.db.bankEventFile.findUniqueOrThrow({where:{id:fileId},select})};
  await this.db.bankEventFile.updateMany({where:{id:fileId,deletedAt:null,scanStatus:'ERROR'},data:{scanStatus:'PENDING'}});
  let status:'CLEAN'|'INFECTED'|'ERROR'='ERROR';
  try{const bytes=await dependencies.storage.get(file.storageKey);if(checksum(bytes)!==file.checksum)throw Error('Checksum mismatch');status=await dependencies.scanner.scan(bytes);}catch{/* Fail closed. No external error or secret reaches the response. */}
  await this.finishScan(fileId,actorId,eventId,status);
  const current=await this.db.$transaction(async tx=>{await this.access(tx,actorId,eventId);return tx.bankEventFile.findFirst({where:{id:fileId,deletedAt:null},select});});
  requireRule(current,404,'NOT_FOUND','Файл удалён');return {file:current};
 }
 async download(actorId:string,eventId:string,fileId:string){
  const file=await this.db.$transaction(async tx=>{
   await this.access(tx,actorId,eventId);const file=await tx.bankEventFile.findFirst({where:{id:fileId,bankEventId:eventId,deletedAt:null}});requireRule(file,404,'NOT_FOUND','Файл не найден');requireRule(file.scanStatus==='CLEAN',409,'FILE_NOT_CLEAN','Скачивание доступно только после успешной проверки');return file;
  });
  let bytes:Buffer;try{bytes=await this.available().storage.get(file.storageKey);if(checksum(bytes)!==file.checksum)throw Error('Checksum mismatch');}catch{throw new AppError(503,'STORAGE_UNAVAILABLE','Файл временно недоступен');}
  // Recheck scope/status after external I/O, before returning any bytes.
  await this.db.$transaction(async tx=>{await this.access(tx,actorId,eventId);requireRule(await tx.bankEventFile.findFirst({where:{id:fileId,bankEventId:eventId,deletedAt:null,scanStatus:'CLEAN'},select:{id:true}}),404,'NOT_FOUND','Файл недоступен');await tx.auditLog.create({data:{actorId,action:'BANK_FILE_DOWNLOADED',entityType:'BankEventFile',entityId:fileId,details:{bankEventId:eventId}}});});
  return {bytes,fileName:file.fileName,mimeType:file.mimeType};
 }
 async remove(actorId:string,eventId:string,fileId:string){
  const file=await this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT "id" FROM "BankEvent" WHERE "id" = ${eventId} FOR UPDATE`;
   await this.access(tx,actorId,eventId,true);const file=await tx.bankEventFile.findFirst({where:{id:fileId,bankEventId:eventId}});requireRule(file,404,'NOT_FOUND','Файл не найден');
   if(!file.deletedAt){await tx.bankEventFile.update({where:{id:fileId},data:{deletedAt:new Date()}});await tx.auditLog.create({data:{actorId,action:'BANK_FILE_DELETED',entityType:'BankEventFile',entityId:fileId,details:{bankEventId:eventId}}});}return file;
  });
  if(file.storageDeletedAt)return {ok:true,cleanupPending:false};
  try{await this.available().storage.remove(file.storageKey);await this.db.bankEventFile.update({where:{id:fileId},data:{storageDeletedAt:new Date()}});return {ok:true,cleanupPending:false};}catch{return {ok:true,cleanupPending:true};}
 }
 // Maintenance only, no public endpoint. Metadata is allocated BEFORE PUT, so an
 // object with no metadata cannot belong to an in-progress upload.
 async cleanup(){
  const {storage}=this.available();let removed=0,failed=0;
  for await(const key of storage.keys()){
   const file=await this.db.bankEventFile.findUnique({where:{storageKey:key},select:{id:true,deletedAt:true}});
   if(file&&!file.deletedAt)continue;
   try{await storage.remove(key);if(file)await this.db.bankEventFile.update({where:{id:file.id},data:{storageDeletedAt:new Date()}});removed++;}catch{failed++;}
  }
  return {removed,failed};
 }
}
