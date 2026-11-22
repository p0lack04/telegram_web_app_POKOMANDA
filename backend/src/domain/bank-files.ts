import {fileTypeFromBuffer} from 'file-type';
import {createHash} from 'node:crypto';
import {requireRule} from '../errors.js';

export const DOCUMENT_LIMIT=20*1024*1024;
export const MEDIA_LIMIT=50*1024*1024;
const types:Record<string,{mime:string;category:'DOCUMENT'|'MEDIA';detected?:string}>={
 pdf:{mime:'application/pdf',category:'DOCUMENT'},
 docx:{mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',category:'DOCUMENT'},
 xlsx:{mime:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',category:'DOCUMENT'},
 pptx:{mime:'application/vnd.openxmlformats-officedocument.presentationml.presentation',category:'DOCUMENT'},
 txt:{mime:'text/plain',category:'DOCUMENT'},
 jpg:{mime:'image/jpeg',category:'MEDIA',detected:'jpg'},jpeg:{mime:'image/jpeg',category:'MEDIA',detected:'jpg'},
 png:{mime:'image/png',category:'MEDIA'},gif:{mime:'image/gif',category:'MEDIA'},
 mp4:{mime:'video/mp4',category:'MEDIA'},mp3:{mime:'audio/mpeg',category:'MEDIA'},wav:{mime:'audio/wav',category:'MEDIA'},
};
export const checksum=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
export async function validateBankFile(name:string,mime:string,bytes:Buffer){
 requireRule(name.length>0&&name.length<=180&&!/[\\/]/.test(name)&&![...name].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)&&name!=='.'&&name!=='..',400,'INVALID_FILE_NAME','Некорректное имя файла');
 const extension=name.split('.').at(-1)?.toLowerCase()??'';
 const type=types[extension];
 requireRule(type,400,'UNSUPPORTED_FILE','Тип файла не поддерживается');
 requireRule(bytes.length>0&&bytes.length<=(type.category==='DOCUMENT'?DOCUMENT_LIMIT:MEDIA_LIMIT),413,'FILE_TOO_LARGE','Документ: до 20 МБ; медиа: до 50 МБ');
 requireRule(mime===type.mime||(extension==='wav'&&mime==='audio/x-wav'),400,'MIME_MISMATCH','Расширение и MIME файла не совпадают');
 if(extension==='txt'){
  let value='';try{value=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{/* rejected below */}
  requireRule(value.length>0&&![...value].some(c=>c.charCodeAt(0)<32&&![9,10,13].includes(c.charCodeAt(0))),400,'CONTENT_MISMATCH','Ожидается текст UTF-8');
 }else{
  const detected=await fileTypeFromBuffer(bytes).catch(()=>undefined);
  requireRule(detected?.ext===(type.detected??extension),400,'CONTENT_MISMATCH','Содержимое не соответствует типу файла');
 }
 return {fileName:name.normalize('NFC'),mimeType:type.mime,fileType:type.category,fileSize:bytes.length,checksum:checksum(bytes),extension};
}
