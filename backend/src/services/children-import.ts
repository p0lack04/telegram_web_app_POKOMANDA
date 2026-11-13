import {createHash} from 'node:crypto';
import {Prisma,type PrismaClient} from '@prisma/client';
import {permissions,requireActive,visibleShiftWhere} from '../domain/permissions.js';
import {squadScope} from '../domain/squads.js';
import {requireRule} from '../errors.js';

type Tx=Prisma.TransactionClient;
export interface ImportRow {rowNumber:number;firstName:string;lastName:string;middleName:string|null;birthDate:string;squadName:string;building?:string|null;room?:string|null;errors:string[];warnings:string[]}
const memberSelect={id:true,squadId:true,firstName:true,lastName:true,middleName:true,birthDate:true,building:true,room:true,updatedAt:true} as const;
type Member=Prisma.SquadMemberGetPayload<{select:typeof memberSelect}>;
const norm=(s:string|null)=> (s??'').normalize('NFC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('ru');
const nameKey=(r:{firstName:string;lastName:string;middleName:string|null})=>JSON.stringify([norm(r.lastName),norm(r.firstName),norm(r.middleName)]);
const identity=(r:ImportRow)=>nameKey(r)+'|'+r.birthDate;
const fingerprint=(m:Member)=>createHash('sha256').update(JSON.stringify(m)).digest('hex');
type Choice={rowNumber:number;action:'new'|'skip'|'match';memberId?:string};
interface Prepared {source:ImportRow;squadId:string|null;candidates:(Member & {fingerprint:string})[];choice:Choice|null;errors:string[];warnings:string[];category:string;changes:Record<string,{before:string|null;after:string|null}>}
interface Preview {revision:number;rows:Prepared[]}
const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export class ChildrenImportService {
 constructor(private db:PrismaClient){}
 private async context(tx:Tx,actorId:string,shiftId:string) {
  const actor=await tx.user.findUniqueOrThrow({where:{id:actorId}});requireActive(actor);
  const shift=await tx.shift.findFirst({where:{id:shiftId,...visibleShiftWhere(actor)}});requireRule(shift,404,'NOT_FOUND','Смена не найдена');
  const roles=await tx.shiftRole.findMany({where:{userId:actorId,shiftId},select:{position:true}});
  const granted=permissions(actor,shift,roles.map(r=>r.position));
  requireRule(granted.has('participants.import'),403,'FORBIDDEN','Импорт участников недоступен');
  const scope=squadScope(granted,actorId,shiftId);requireRule(scope,403,'FORBIDDEN','Отряды недоступны');
  const squads=await tx.squad.findMany({where:scope,select:{id:true,name:true}});
  // Fetch only children in visible objects; never expose a hidden candidate.
  const members=await tx.squadMember.findMany({where:{shiftId,memberType:'CHILD',squadId:{in:squads.map(s=>s.id)}},select:memberSelect});
  return {granted,squads,members};
 }
 private async lock(tx:Tx,shiftId:string){await tx.$queryRaw`SELECT "id" FROM "Shift" WHERE "id" = ${shiftId} FOR UPDATE`;}
 async authorize(actorId:string,shiftId:string){await this.db.$transaction(tx=>this.context(tx,actorId,shiftId));}
 private prepare(rows:ImportRow[],ctx:Awaited<ReturnType<ChildrenImportService['context']>>,choices:Choice[]=[]) {
  const frequencies=new Map<string,number>();for(const r of rows)frequencies.set(identity(r),(frequencies.get(identity(r))??0)+1);
  return rows.map(source=>{
   const errors=[...source.errors],warnings=[...source.warnings];
   const squads=ctx.squads.filter(s=>norm(s.name)===norm(source.squadName));
   const squadId=squads.length===1?squads[0]!.id:null;
   if(!squadId)errors.push('SQUAD_NOT_AVAILABLE');
   if((frequencies.get(identity(source))??0)>1)errors.push('DUPLICATE_OR_CONFLICTING_ROWS');
   const candidates=ctx.members.filter(m=>nameKey(m)===nameKey(source)&&m.birthDate?.toISOString().slice(0,10)===source.birthDate).map(m=>({...m,fingerprint:fingerprint(m)}));
   if(ctx.members.some(m=>nameKey(m)===nameKey(source)&&m.birthDate?.toISOString().slice(0,10)!==source.birthDate))warnings.push('IDENTITY_REQUIRES_ATTENTION');
   const choice=choices.find(c=>c.rowNumber===source.rowNumber)??null;
   let category=errors.length?'ERROR':candidates.length?'UNRESOLVED':'NEW';
   const changes:Prepared['changes']={};
   if(choice?.action==='skip')category='SKIPPED';
   else if(!errors.length&&choice?.action==='new'&&candidates.length){errors.push('CANDIDATE_REQUIRES_MAPPING');category='UNRESOLVED';}
   else if(!errors.length&&choice?.action==='match'){
    const target=candidates.find(c=>c.id===choice.memberId);
    if(!target){errors.push('INVALID_CANDIDATE');category='ERROR';}
    else {
     if(squadId!==target.squadId)changes.squadId={before:target.squadId,after:squadId};
     for(const key of ['building','room'] as const){const value=source[key];if(typeof value==='string'&&value.trim()&&value!==target[key])changes[key]={before:target[key],after:value};else if(!value&&target[key])warnings.push(`${key.toUpperCase()}_PRESERVED`);}
     category=Object.keys(changes).length?'UPDATE':'UNCHANGED';
     if(category==='UPDATE'&&!ctx.granted.has('participants.edit_room')){errors.push('EDIT_ROOM_REQUIRED');category='FORBIDDEN';}
    }
   }
   return {source,squadId,candidates,choice,errors,warnings,category,changes} satisfies Prepared;
  });
 }
 private dto(job:{id:string;expiresAt:Date},preview:Preview){return {jobId:job.id,revision:preview.revision,expiresAt:job.expiresAt,rows:preview.rows.map(r=>({rowNumber:r.source.rowNumber,category:r.category,errors:r.errors,warnings:r.warnings,data:r.source,candidates:r.candidates.map(({fingerprint:_,updatedAt:__,...candidate})=>candidate),choice:r.choice,changes:r.changes})),counts:preview.rows.reduce<Record<string,number>>((a,r)=>{a[r.category]=(a[r.category]??0)+1;return a;},{})};}
 async preview(actorId:string,shiftId:string,sourceHash:string,rows:ImportRow[]){
  return this.db.$transaction(async tx=>{
   await this.lock(tx,shiftId);const ctx=await this.context(tx,actorId,shiftId);
   const preview:Preview={revision:1,rows:this.prepare(rows,ctx)};
   const job=await tx.importJob.create({data:{actorId,shiftId,sourceHash,kind:'CHILD_XLSX',preview:json(preview),expiresAt:new Date(Date.now()+3600000)}});
   return this.dto(job,preview);
  },{timeout:15000});
 }
 private async job(tx:Tx,actorId:string,shiftId:string,jobId:string){
  const job=await tx.importJob.findFirst({where:{id:jobId,actorId,shiftId,kind:'CHILD_XLSX'}});requireRule(job,404,'NOT_FOUND','Задание не найдено');return job;
 }
 private current(job:{status:string;expiresAt:Date;preview:Prisma.JsonValue},revision?:number){
  requireRule(job.status!=='EXPIRED'&&(job.status==='COMMITTED'||job.expiresAt.getTime()>Date.now()),410,'IMPORT_EXPIRED','Предпросмотр истёк');
  requireRule(job.status==='PREVIEW',409,'IMPORT_STATE','Задание уже обработано');
  const preview=job.preview as unknown as Preview;
  if(revision!==undefined)requireRule(preview.revision===revision,409,'STALE_REVISION','Предпросмотр изменился');
  return preview;
 }
 async get(actorId:string,shiftId:string,jobId:string){return this.db.$transaction(async tx=>{await this.context(tx,actorId,shiftId);const job=await this.job(tx,actorId,shiftId,jobId);if(job.status==='COMMITTED')return {jobId:job.id,status:'COMMITTED',result:job.preview};return this.dto(job,this.current(job));});}
 async mapping(actorId:string,shiftId:string,jobId:string,revision:number,choices:Choice[]){
  return this.db.$transaction(async tx=>{
   await this.lock(tx,shiftId);const ctx=await this.context(tx,actorId,shiftId);const job=await this.job(tx,actorId,shiftId,jobId);const old=this.current(job,revision);
   requireRule(new Set(choices.map(c=>c.rowNumber)).size===choices.length&&choices.every(c=>old.rows.some(r=>r.source.rowNumber===c.rowNumber)),400,'INVALID_MAPPING','Проверьте номера строк');
   const merged=old.rows.map(r=>choices.find(c=>c.rowNumber===r.source.rowNumber)??r.choice).filter((c):c is Choice=>c!==null);
   const preview:Preview={revision:old.revision+1,rows:this.prepare(old.rows.map(r=>r.source),ctx,merged)};
   const selected=preview.rows.filter(r=>r.choice?.action==='match').map(r=>r.choice!.memberId);
   requireRule(new Set(selected).size===selected.length,400,'DUPLICATE_TARGET','Одну запись нельзя выбрать для нескольких строк');
   const saved=await tx.importJob.updateMany({where:{id:jobId,status:'PREVIEW',expiresAt:{gt:new Date()}},data:{preview:json(preview)}});
   requireRule(saved.count===1,410,'IMPORT_EXPIRED','Предпросмотр истёк');return this.dto(job,preview);
  },{timeout:15000});
 }
 async commit(actorId:string,shiftId:string,jobId:string,revision:number){
  return this.db.$transaction(async tx=>{
   await this.lock(tx,shiftId);const ctx=await this.context(tx,actorId,shiftId);const job=await this.job(tx,actorId,shiftId,jobId);
   if(job.status==='COMMITTED')return {jobId,status:'COMMITTED',result:job.preview};
   const preview=this.current(job,revision);
   const fresh=this.prepare(preview.rows.map(r=>r.source),ctx,preview.rows.flatMap(r=>r.choice?[r.choice]:[]));
   const resultRows:{rowNumber:number;status:string;memberId?:string;reasons:string[];warnings:string[]}[]=[];
   for(let i=0;i<preview.rows.length;i++){
    const old=preview.rows[i]!,row=fresh[i]!;
    const result:{rowNumber:number;status:string;memberId?:string;reasons:string[];warnings:string[]}={rowNumber:row.source.rowNumber,status:'SKIPPED',reasons:[...row.errors],warnings:row.warnings};
    const permitted=['NEW','UPDATE','UNCHANGED'];
    if(!permitted.includes(old.category)||!permitted.includes(row.category)){if(!result.reasons.length)result.reasons.push(row.category);resultRows.push(result);continue;}
    // Never silently commit a different proposal from the final preview.
    const snapshot=(r:Prepared)=>JSON.stringify({squadId:r.squadId,category:r.category,changes:Object.entries(r.changes).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,value.before,value.after]),candidates:r.candidates.map(c=>[c.id,c.fingerprint]).sort(([a],[b])=>a!.localeCompare(b!))});
    if(snapshot(old)!==snapshot(row)){result.reasons=['DATA_CHANGED'];resultRows.push(result);continue;}
    if(row.category==='NEW'){
     const member=await tx.squadMember.create({data:{shiftId,squadId:row.squadId!,memberType:'CHILD',firstName:row.source.firstName,lastName:row.source.lastName,middleName:row.source.middleName,birthDate:new Date(row.source.birthDate+'T00:00:00Z'),building:row.source.building||null,room:row.source.room||null},select:{id:true}});
     result.memberId=member.id;result.status='CREATED';
    }else {
     result.memberId=row.choice!.memberId;
     if(row.category==='UPDATE'){
      const data=Object.fromEntries(Object.entries(row.changes).map(([k,v])=>[k,v.after]));
      await tx.squadMember.update({where:{id:result.memberId},data});result.status='UPDATED';
     }else result.status='UNCHANGED';
    }
    if(result.status!=='UNCHANGED')await tx.auditLog.create({data:{actorId,shiftId,action:`CHILD_IMPORT_${result.status}`,entityType:'SquadMember',entityId:result.memberId!}});
    resultRows.push(result);
   }
   const counts=resultRows.reduce<Record<string,number>>((a,r)=>{a[r.status]=(a[r.status]??0)+1;return a;},{});
   const result={rows:resultRows,counts,noChanges:!resultRows.some(r=>['CREATED','UPDATED'].includes(r.status))};
   const committed=await tx.importJob.updateMany({where:{id:jobId,status:'PREVIEW',expiresAt:{gt:new Date()}},data:{status:'COMMITTED',committedAt:new Date(),preview:json(result)}});
   requireRule(committed.count===1,410,'IMPORT_EXPIRED','Предпросмотр истёк');
   await tx.auditLog.create({data:{actorId,shiftId,action:'CHILD_IMPORT_COMMITTED',entityType:'ImportJob',entityId:jobId,details:{counts}}});
   return {jobId,status:'COMMITTED',result};
  },{timeout:20000});
 }
}

export async function cleanupChildPreviews(db:PrismaClient,now=new Date()){
 // Single conditional UPDATE cannot overwrite a committed result, even in a race.
 return db.importJob.updateMany({where:{kind:'CHILD_XLSX',status:'PREVIEW',expiresAt:{lte:now}},data:{status:'EXPIRED',preview:{reason:'PREVIEW_EXPIRED'}}});
}
