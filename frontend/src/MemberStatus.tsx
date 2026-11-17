import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {api,ApiError} from './api';
import {refreshSquads,squadError} from './SquadManagement';

export interface MemberStatusData {member:{id:string;paymentStatus:'UNPAID'|'PARTIAL'|'PAID';paymentNote:string|null;checkinStatus:boolean;updatedAt:string};capabilities:{editPayment:boolean;editCheckin:boolean}}
interface Mark {id:string;date:string;markType:'FULL_DAY'|'TECHNIC';note:string|null;updatedAt:string}
interface MarkPage {items:Mark[];total:number;timeZone:string;today:string;capabilities:{edit:boolean}}
const paymentLabels={UNPAID:'Не оплачено',PARTIAL:'Частично оплачено',PAID:'Оплачено'};
export function MemberStatus({shiftId,memberId}:{shiftId:string;memberId:string}) {
 const [open,setOpen]=useState(false);
 return <><button className="secondary" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{open?'Скрыть оплату, заезд и отметки':'Оплата, заезд и отметки'}</button>{open&&<MemberStatusPanel shiftId={shiftId} memberId={memberId}/>}</>;
}
export function MemberStatusPanel({shiftId,memberId}:{shiftId:string;memberId:string}) {
 const [saved,setSaved]=useState(false);const [revision,setRevision]=useState(0);
 const query=useQuery({queryKey:['member-status',shiftId,memberId],queryFn:()=>api<MemberStatusData>(`/shifts/${shiftId}/squad-members/${memberId}/status`),retry:false});
 if(query.isError)return <div role="alert" className="notice error"><p>{squadError(query.error)}</p><button onClick={()=>void query.refetch()}>Повторить загрузку статуса</button></div>;
 if(query.isPending)return <p role="status">Загружаем оплату и заезд…</p>;
 return <section aria-label="Оплата, заезд и отметки">{saved&&<p role="status">Изменения сохранены.</p>}<StatusEditor key={revision} shiftId={shiftId} data={query.data} reload={()=>void query.refetch().then(result=>{if(result.isSuccess)setRevision(v=>v+1);})} saved={()=>setSaved(true)} editing={()=>setSaved(false)}/><DailyMarks shiftId={shiftId} memberId={memberId}/></section>;
}
export function StatusEditor({shiftId,data,reload,saved=()=>{},editing=()=>{}}:{shiftId:string;data:MemberStatusData;reload:()=>void;saved?:()=>void;editing?:()=>void}) {
 const client=useQueryClient();const [member,setMember]=useState(data.member);const {capabilities}=data;
 const [payment,setPayment]=useState(member.paymentStatus);const [note,setNote]=useState(member.paymentNote??'');const [checkin,setCheckin]=useState(member.checkinStatus);
 const mutation=useMutation({mutationFn:({kind,body}:{kind:'payment'|'checkin';body:object})=>api<{member:MemberStatusData['member']}>(`/shifts/${shiftId}/squad-members/${member.id}/${kind}`,{...body,updatedAt:member.updatedAt},'PATCH'),onSuccess:async result=>{setMember(result.member);await refreshSquads(client,shiftId);saved();}});
 return <div className="panel" onChange={editing}><p>Оплата: {paymentLabels[member.paymentStatus]}</p>{member.paymentNote&&<p className="multiline">Примечание к оплате: {member.paymentNote}</p>}<p>Заезд: {member.checkinStatus?'отмечен':'не отмечен'}</p>
 {capabilities.editPayment&&<form onSubmit={e=>{e.preventDefault();mutation.mutate({kind:'payment',body:{paymentStatus:payment,paymentNote:note.trim()||null}});}}><fieldset disabled={mutation.isPending}><label className="field"><span>Статус оплаты</span><select value={payment} onChange={e=>setPayment(e.target.value as typeof payment)}>{Object.entries(paymentLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="field"><span>Примечание к оплате</span><textarea value={note} required={payment==='PARTIAL'} maxLength={500} onChange={e=>setNote(e.target.value)}/><small>Для частичной оплаты обязательно непустое примечание.</small></label><button disabled={payment==='PARTIAL'&&!note.trim()}>Сохранить оплату</button></fieldset></form>}
 {capabilities.editCheckin&&<form onSubmit={e=>{e.preventDefault();mutation.mutate({kind:'checkin',body:{checkinStatus:checkin}});}}><fieldset disabled={mutation.isPending}><label className="checkbox"><input type="checkbox" checked={checkin} onChange={e=>setCheckin(e.target.checked)}/>Заезд отмечен</label><button>Сохранить заезд</button></fieldset></form>}
 {mutation.isPending&&<p role="status">Сохраняем изменения…</p>}{mutation.isError&&<div className="notice error" role="alert"><p>{squadError(mutation.error)}</p>{mutation.error instanceof ApiError&&mutation.error.status===409&&<><p>Введённые значения сохранены в форме. Перечитайте актуальный статус перед повторным изменением.</p><button onClick={reload}>Перечитать статус</button></>}</div>}</div>;
}
export function DailyMarks({shiftId,memberId}:{shiftId:string;memberId:string}) {
 const [date,setDate]=useState('');const [page,setPage]=useState(1);
 const query=useQuery({queryKey:['daily-marks',shiftId,memberId,'list',page],queryFn:()=>api<MarkPage>(`/shifts/${shiftId}/squad-members/${memberId}/daily-marks?page=${page}&pageSize=20`),retry:false});
 if(query.isError)return <div className="notice error" role="alert"><p>{squadError(query.error)}</p><button onClick={()=>void query.refetch()}>Повторить загрузку отметок</button></div>;
 if(query.isPending)return <p role="status">Загружаем ежедневные отметки…</p>;
 return <section aria-label="Ежедневные отметки"><h4>Ежедневные отметки</h4>{query.data.items.length?<ul className="record-list">{query.data.items.map(mark=><li key={mark.id}><strong>{mark.date.slice(0,10)} · {mark.markType==='FULL_DAY'?'Полный день':'Техник'}</strong>{mark.note&&<p className="multiline">{mark.note}</p>}</li>)}</ul>:<p>Ежедневных отметок пока нет.</p>}
 {(query.data.total>20||page>1)&&<nav aria-label="Страницы ежедневных отметок" className="pagination"><button className="secondary" disabled={page===1} onClick={()=>setPage(p=>p-1)}>Назад</button><span>Страница {page}</span><button className="secondary" disabled={page*20>=query.data.total} onClick={()=>setPage(p=>p+1)}>Далее</button></nav>}
 {query.data.timeZone&&<p className="muted">Часовой пояс смены: {query.data.timeZone}</p>}{query.data.capabilities.edit&&<><label className="field"><span>Дата отметки</span><input type="date" value={date} onChange={e=>setDate(e.target.value)}/><small>Выберите календарный день явно.</small></label>{query.data.today&&<button className="secondary" onClick={()=>setDate(query.data.today)}>Сегодня по времени смены</button>}{date&&<SelectedMark key={date} shiftId={shiftId} memberId={memberId} date={date}/>}</>}</section>;
}
function SelectedMark({shiftId,memberId,date}:{shiftId:string;memberId:string;date:string}) {
 const [revision,setRevision]=useState(0);
 const query=useQuery({queryKey:['daily-marks',shiftId,memberId,'date',date],queryFn:()=>api<MarkPage>(`/shifts/${shiftId}/squad-members/${memberId}/daily-marks?date=${encodeURIComponent(date)}`),retry:false});
 if(query.isError)return <p role="alert">{squadError(query.error)} <button onClick={()=>void query.refetch()}>Повторить загрузку дня</button></p>;
 if(query.isPending)return <p role="status">Загружаем выбранный день…</p>;
 return query.data.capabilities.edit?<MarkEditor key={revision} shiftId={shiftId} memberId={memberId} date={date} existing={query.data.items[0]} reload={()=>void query.refetch().then(result=>{if(result.isSuccess)setRevision(v=>v+1);})}/>:<p>Изменение отметок недоступно.</p>;
}
function MarkEditor({shiftId,memberId,date,existing,reload}:{shiftId:string;memberId:string;date:string;existing?:Mark;reload:()=>void}) {
 const client=useQueryClient();const [snapshot,setSnapshot]=useState(existing);const [markType,setType]=useState(existing?.markType??'FULL_DAY');const [note,setNote]=useState(existing?.note??'');
 const mutation=useMutation({mutationFn:()=>api<{mark:Mark}>(`/shifts/${shiftId}/squad-members/${memberId}/daily-marks`,{date,markType,note:note.trim()||null,updatedAt:snapshot?.updatedAt??null}),onSuccess:async result=>{setSnapshot(result.mark);await refreshSquads(client,shiftId);}});
 return <><form onSubmit={e=>{e.preventDefault();mutation.mutate();}}><fieldset disabled={mutation.isPending}><label className="field"><span>Тип отметки</span><select value={markType} onChange={e=>setType(e.target.value as Mark['markType'])}><option value="FULL_DAY">Полный день</option><option value="TECHNIC">Техник</option></select></label><label className="field"><span>Примечание к отметке</span><textarea maxLength={500} value={note} onChange={e=>setNote(e.target.value)}/></label><button>{mutation.isPending?'Сохраняем отметку…':'Сохранить отметку'}</button></fieldset></form>{mutation.isSuccess&&<p role="status">Ежедневная отметка сохранена.</p>}{mutation.isError&&<div role="alert" className="notice error"><p>{squadError(mutation.error)}</p>{mutation.error instanceof ApiError&&mutation.error.status===409&&<><p>Отметка изменена другим пользователем. Введённые значения остаются в форме до перечитывания.</p><button onClick={reload}>Перечитать отметки</button></>}</div>}</>;
}
