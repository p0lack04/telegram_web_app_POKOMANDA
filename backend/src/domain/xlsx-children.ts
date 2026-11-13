import {inflateRawSync} from 'node:zlib';
import {readSheet,type SheetData} from 'read-excel-file/node';
import {AppError,requireRule} from '../errors.js';
import type {ImportRow} from '../services/children-import.js';
const invalid=()=>new AppError(400,'INVALID_XLSX','Некорректный или неподдерживаемый XLSX');
function crc32(buffer:Buffer){let crc=0xffffffff;for(const byte of buffer){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
// Bound actual decompression, not just ZIP metadata; reject ZIP64, aliases and ambiguous entries.
export function checkedXlsxEntries(buffer:Buffer):Map<string,Buffer>{
 try {
  requireRule(buffer.length<=2*1024*1024&&buffer.readUInt32LE(0)===0x04034b50,400,'INVALID_XLSX','Некорректный XLSX');
  let end=-1;for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--)if(buffer.readUInt32LE(i)===0x06054b50){end=i;break;}
  if(end<0||end+22+buffer.readUInt16LE(end+20)!==buffer.length)throw invalid();
  const count=buffer.readUInt16LE(end+10),start=buffer.readUInt32LE(end+16),size=buffer.readUInt32LE(end+12);
  if(buffer.readUInt32LE(end+4)!==0||count!==buffer.readUInt16LE(end+8)||count>100||start+size!==end)throw invalid();
  const files=new Map<string,Buffer>();let pos=start,total=0;const ranges:{start:number;end:number}[]=[];
  for(let n=0;n<count;n++){
   if(buffer.readUInt32LE(pos)!==0x02014b50)throw invalid();
    const flags=buffer.readUInt16LE(pos+8),method=buffer.readUInt16LE(pos+10),centralCrc=buffer.readUInt32LE(pos+16),compressed=buffer.readUInt32LE(pos+20),uncompressed=buffer.readUInt32LE(pos+24),nl=buffer.readUInt16LE(pos+28),el=buffer.readUInt16LE(pos+30),cl=buffer.readUInt16LE(pos+32),offset=buffer.readUInt32LE(pos+42);
   const name=buffer.subarray(pos+46,pos+46+nl).toString('utf8');
   if(flags&1||![0,8].includes(method)||uncompressed>8*1024*1024||compressed>buffer.length||offset+30>=start||files.has(name)||name.includes('..')||name.includes('\\')||name.startsWith('/'))throw invalid();
    if(offset+30>start||buffer.readUInt32LE(offset)!==0x04034b50||buffer.readUInt16LE(offset+8)!==method)throw invalid();
    const localNameLength=buffer.readUInt16LE(offset+26),localExtra=buffer.readUInt16LE(offset+28);
    if(offset+30+localNameLength+localExtra>start)throw invalid();
    if(buffer.subarray(offset+30,offset+30+localNameLength).toString('utf8')!==name)throw invalid();
    const dataStart=offset+30+localNameLength+localExtra;
    if(dataStart+compressed>start)throw invalid();
    const localEnd=dataStart+compressed;
    if(ranges.some(range=>offset<range.end&&localEnd>range.start))throw invalid();
    ranges.push({start:offset,end:localEnd});
    const localCrc=buffer.readUInt32LE(offset+14),localCompressed=buffer.readUInt32LE(offset+18),localUncompressed=buffer.readUInt32LE(offset+22);
    if(flags&8){
      const descriptorStart=localEnd;
      const descriptorSize=buffer.readUInt32LE(descriptorStart)===0x08074b50?16:12;
      if(descriptorStart+descriptorSize>start)throw invalid();
      const descriptorOffset=descriptorSize===16?descriptorStart+4:descriptorStart;
      if(buffer.readUInt32LE(descriptorOffset)!==centralCrc||buffer.readUInt32LE(descriptorOffset+4)!==compressed||buffer.readUInt32LE(descriptorOffset+8)!==uncompressed)throw invalid();
    }else if(localCrc!==centralCrc||localCompressed!==compressed||localUncompressed!==uncompressed)throw invalid();
    const raw=buffer.subarray(dataStart,dataStart+compressed);
    const data=method===8?inflateRawSync(raw,{maxOutputLength:8*1024*1024}):raw;
    const crc=crc32(data);
    if(data.length!==uncompressed||crc!==centralCrc||(total+=data.length)>16*1024*1024)throw invalid();
   if(/\.(xml|rels)$/i.test(name)){
    const xml=data.toString('utf8');
    if(xml.includes('\u0000')||(xml.match(/<(?:\w+:)?row\b/g)?.length??0)>1001||(xml.match(/<(?:\w+:)?c\b/g)?.length??0)>20020)throw invalid();
    if(/<!DOCTYPE|<!ENTITY|<\s*(?:\w+:)?f(?:\s|>|\/)|TargetMode\s*=\s*["']External["']/i.test(xml))throw invalid();
    // Avoid sparse worksheet dimensions allocating unbounded arrays in the library.
    for(const match of xml.matchAll(/(?:^|\s)r\s*=\s*(["'])([\s\S]*?)\1/g)){
     const coordinate=match[2]!;
     if(!/^(?:[A-T])?[1-9]\d{0,3}$/.test(coordinate)||Number(coordinate.replace(/^[A-T]/,''))>1001)throw invalid();
    }
   }
   files.set(name,data);pos+=46+nl+el+cl;
  }
  if(pos!==end||!files.has('[Content_Types].xml')||!files.has('xl/workbook.xml'))throw invalid();
  return files;
 }catch(error){if(error instanceof AppError)throw error;throw invalid();}
}
const text=(value:unknown)=>typeof value==='string'||typeof value==='number'?String(value).normalize('NFC').trim().replace(/\s+/gu,' '):'';
function date(value:unknown):string|null{
 if(value instanceof Date){if(!Number.isFinite(value.getTime()))return null;return value.toISOString().slice(0,10);}
 if(typeof value!=='string')return null;
 let iso=value.trim();const m=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(iso);if(m)iso=`${m[3]}-${m[2]}-${m[1]}`;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return null;
 const d=new Date(iso+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===iso?iso:null;
}
export async function parseChildrenXlsx(buffer:Buffer):Promise<ImportRow[]>{
 checkedXlsxEntries(buffer);
 let matrix:SheetData;
 try{matrix=await readSheet(buffer,1);}catch{throw invalid();}
 requireRule(matrix.length>0&&matrix.length<=1001,400,'XLSX_ROWS','Файл должен содержать заголовок и не более 1000 строк');
 const headers=matrix[0]!.map(v=>text(v).toLocaleLowerCase('ru'));
 requireRule(headers.length<=20&&new Set(headers.filter(Boolean)).size===headers.filter(Boolean).length,400,'XLSX_HEADERS','Проверьте заголовки колонок');
 for(const h of ['фамилия','имя','дата рождения','отряд'])requireRule(headers.includes(h),400,'XLSX_HEADERS','Отсутствует обязательная колонка');
 const rows:ImportRow[]=[];
 for(let i=1;i<matrix.length;i++){
  const row=matrix[i]!;if(row.every(v=>v===null||v===''))continue;
  const get=(header:string)=>row[headers.indexOf(header)];
  const errors:string[]=[],warnings:string[]=[];
  const firstName=text(get('имя')),lastName=text(get('фамилия')),middleName=text(get('отчество'))||null,squadName=text(get('отряд')),birthDate=date(get('дата рождения'));
  if(!firstName||!lastName)errors.push('NAME_REQUIRED');
  if(!birthDate)errors.push('INVALID_BIRTH_DATE');
  if(!squadName)errors.push('SQUAD_REQUIRED');
  if([firstName,lastName,middleName??'',squadName].some(v=>v.length>100))errors.push('VALUE_TOO_LONG');
  if(headers.some(h=>['оплата','заезд'].includes(h)))warnings.push('PAYMENT_CHECKIN_IGNORED');
  const result:ImportRow={rowNumber:i+1,firstName,lastName,middleName,birthDate:birthDate??'',squadName,errors,warnings};
  for(const [header,key] of [['корпус','building'],['комната','room']] as const)if(headers.includes(header)){const value=text(get(header));result[key]=value||null;if(value.length>100)errors.push('VALUE_TOO_LONG');}
  rows.push(result);
 }
 requireRule(rows.length>0,400,'XLSX_EMPTY','В файле нет строк участников');return rows;
}
