import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {api,ApiError,upload} from './api';
import {type Child} from './types';

export function mutationError(error:unknown):string {
 if(error instanceof ApiError){
  if(error.status===400)return 'Проверьте заполнение полей. '+error.message;
  if(error.status===403)return 'Нет права на это действие. '+error.message;
  if(error.status===404)return 'Запись или отряд больше недоступны.';
  if(error.status===410)return 'Предпросмотр истёк. Загрузите файл заново.';
  if(error.status===409)return 'Предпросмотр изменился. Обновите его перед подтверждением.';
  return error.message;
 }
 return 'Не удалось выполнить запрос. Повторите попытку.';
}
export interface ImportPreview {
 jobId:string;revision:number;counts:Record<string,number>;
 rows:{rowNumber:number;category:string;errors:string[];warnings:string[];data:{firstName:string;lastName:string;middleName:string|null;birthDate:string;squadName:string;building?:string|null;room?:string|null};candidates:Child[];choice:{action:string;memberId?:string}|null;changes:Record<string,{before:string|null;after:string|null}>}[];
}
interface ImportResult {rows:{rowNumber:number;status:string;reasons:string[];warnings:string[]}[];counts:Record<string,number>;noChanges:boolean}
const labels:Record<string,string>={NEW:'Новая запись',UPDATE:'Изменение',UNCHANGED:'Без изменений',UNRESOLVED:'Требуется сопоставление',AMBIGUOUS:'Неоднозначное совпадение',ERROR:'Ошибка',FORBIDDEN:'Нет права',SKIPPED:'Пропущено',CREATED:'Создано',UPDATED:'Обновлено'};
const fields:Record<string,string>={squadId:'Отряд (ID)',building:'Корпус',room:'Комната'};
const reasons:Record<string,string>={SQUAD_NOT_AVAILABLE:'Отряд недоступен',DUPLICATE_OR_CONFLICTING_ROWS:'Повторяющиеся или конфликтующие строки',IDENTITY_REQUIRES_ATTENTION:'Проверьте имя и дату рождения',CANDIDATE_REQUIRES_MAPPING:'Выберите существующую запись',INVALID_CANDIDATE:'Кандидат недоступен',EDIT_ROOM_REQUIRED:'Нет права изменять размещение',BUILDING_PRESERVED:'Корпус сохранён',ROOM_PRESERVED:'Комната сохранена',DATA_CHANGED:'Запись изменилась после предпросмотра',UNSUPPORTED_MEMBER_TYPE:'Поддерживаются только дети (CHILD)'};
const reason=(value:string)=>reasons[value]??labels[value]??value;
export function PreviewTable({job,pending,map}:{job:ImportPreview;pending:boolean;map:(row:number,value:string)=>void}){
 return <div className="import-table-scroll" tabIndex={0} role="region" aria-label="Таблица импорта"><table className="import-table" aria-label="Предпросмотр импорта"><thead><tr><th>Строка / статус</th><th>Данные из файла</th><th>Изменения / сопоставление</th></tr></thead><tbody>{job.rows.map(row=><tr key={row.rowNumber}>
  <td>{row.rowNumber}<p>{labels[row.category]??row.category}</p>{row.errors.concat(row.warnings).map((value,i)=><p key={i}>{reason(value)}</p>)}</td>
  <td>{[row.data.lastName,row.data.firstName,row.data.middleName].filter(Boolean).join(' ')}<p>{row.data.birthDate} · {row.data.squadName}</p><p>Корпус: {row.data.building||'—'}; комната: {row.data.room||'—'}</p></td>
  <td>{Object.entries(row.changes).map(([key,value])=><p key={key}>{fields[key]??key}: {value.before||'—'} → {value.after||'—'}</p>)}<select aria-label={`Сопоставление строки ${row.rowNumber}`} disabled={pending} value={row.choice?.action==='match'?row.choice.memberId:row.choice?.action??''} onChange={e=>map(row.rowNumber,e.target.value)}><option value="" disabled>Выберите действие</option><option value="skip">Пропустить строку</option>{row.candidates.length===0&&<option value="new">Новая запись</option>}{row.candidates.map(c=><option key={c.id} value={c.id}>{[c.lastName,c.firstName,c.middleName].filter(Boolean).join(' ')} · {c.birthDate?.slice(0,10)} · отряд {c.squadId} · {c.building||'—'}/{c.room||'—'} · ID {c.id}</option>)}</select></td>
 </tr>)}</tbody></table></div>;
}
export function ImportChildren({shiftId}:{shiftId:string}){
 const client=useQueryClient();const [job,setJob]=useState<ImportPreview|null>(null);const [result,setResult]=useState<ImportResult|null>(null);const [error,setError]=useState<string|null>(null);const [pending,setPending]=useState(false);
 const select=async(event:React.ChangeEvent<HTMLInputElement>)=>{const input=event.currentTarget;const file=input.files?.[0];if(!file)return;setPending(true);setError(null);setResult(null);setJob(null);try{setJob(await upload(`/shifts/${shiftId}/children/import/preview`,file));}catch(e){setError(mutationError(e));}finally{setPending(false);input.value='';}};
 const perform=async(action:()=>Promise<void>)=>{setPending(true);setError(null);try{await action();}catch(e){setError(mutationError(e));}finally{setPending(false);}};
 const commit=()=>perform(async()=>{if(!job)return;const response=await api<{result:ImportResult}>(`/shifts/${shiftId}/children/import/${job.jobId}/commit`,{revision:job.revision,confirmed:true});setResult(response.result);setJob(null);await client.invalidateQueries({queryKey:['children',shiftId]});});
 const map=(row:number,value:string)=>void perform(async()=>{if(!job)return;setJob(await api(`/shifts/${shiftId}/children/import/${job.jobId}/mapping`,{revision:job.revision,choices:[{rowNumber:row,...(value==='skip'||value==='new'?{action:value}:{action:'match',memberId:value})}]}));});
 const reload=()=>perform(async()=>{if(!job)return;const response=await api<ImportPreview|{status:'COMMITTED';result:ImportResult}>(`/shifts/${shiftId}/children/import/${job.jobId}`);if('status' in response){setResult(response.result);setJob(null);await client.invalidateQueries({queryKey:['children',shiftId]});}else setJob(response);});
 return <section className="panel"><h3>Импорт XLSX</h3><p className="muted">Только дети. Проверьте каждую строку и сопоставление. Ошибочные и несопоставленные строки будут пропущены.</p><label className="field"><span>Файл XLSX</span><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={pending} onChange={event=>void select(event)}/></label>
 {pending&&<p role="status">Обрабатываем запрос…</p>}{error&&<p className="notice error" role="alert">{error}</p>}
 {job&&<><p>Предпросмотр: строк — {job.rows.length}.</p><p>{Object.entries(job.counts).map(([key,count])=>`${labels[key]??key}: ${count}`).join('; ')}</p><PreviewTable job={job} pending={pending} map={map}/><p>Подтверждение применит новые записи и изменения из предпросмотра. Остальные строки останутся без записи.</p><div className="form-actions"><button disabled={pending} onClick={()=>void commit()}>Подтвердить импорт</button><button className="secondary" disabled={pending} onClick={()=>void reload()}>Обновить предпросмотр</button><button className="secondary" disabled={pending} onClick={()=>{setJob(null);setError(null);}}>Закрыть предпросмотр</button></div></>}
 {result&&<div aria-label="Результат импорта" role="region"><p className="notice" role="status">Импорт завершён. {result.noChanges?'Изменений нет.':''}</p><p>{Object.entries(result.counts).map(([key,count])=>`${labels[key]??key}: ${count}`).join('; ')}</p><ul>{result.rows.map(row=><li key={row.rowNumber}>Строка {row.rowNumber}: {labels[row.status]??row.status}{row.reasons.concat(row.warnings).length>0?` — ${row.reasons.concat(row.warnings).map(reason).join(', ')}`:''}</li>)}</ul></div>}
 </section>;
}
