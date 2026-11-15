import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {api,ApiError} from './api';
type Item={id:string;title:string;description:string|null;date:string;startTime:string;endTime:string;location:string|null;type:string;sortOrder:number;updatedAt:string;isLocked:boolean;responsibleId:string|null;bankEventId:string|null;bankEvent:{id:string;title:string}|null;responsible:{firstName:string;lastName:string|null}|null;capabilities:{edit:boolean;manage:boolean;lock:boolean}};
type ProgramData={days:string[];date:string|null;items:Item[];conflicts:Array<{firstId:string;secondId:string;date:string}>;capabilities:{reorder:boolean;create:boolean;fullEdit:boolean;propose:boolean;decide:boolean}};
type Proposal={id:string;text:string;status:string;createdAt:string};
const errorText=(error:unknown)=>error instanceof Error?error.message:'Не удалось выполнить действие';
export default function Program({shiftId}:{shiftId:string}) {
 const [date,setDate]=useState('');const [page,setPage]=useState(1);const [text,setText]=useState('');const [editor,setEditor]=useState<Item|'new'|null>(null);const [deleting,setDeleting]=useState<string|null>(null);const client=useQueryClient();const path='/shifts/'+shiftId;
 const query=useQuery({queryKey:['program',shiftId,date],queryFn:()=>api<ProgramData>(path+'/program'+(date?'?date='+date:''))});
 const proposals=useQuery({queryKey:['program-proposals',shiftId,page],queryFn:()=>api<{items:Proposal[];total:number}>(path+'/program-proposals?page='+page)});
 const refresh=()=>{void client.invalidateQueries({queryKey:['program',shiftId]});void client.invalidateQueries({queryKey:['program-history',shiftId]});void client.invalidateQueries({queryKey:['program-proposals',shiftId]});};
 const propose=useMutation({mutationFn:()=>api(path+'/program-proposals',{text}),onSuccess:()=>{setText('');refresh();}});
 const decide=useMutation({mutationFn:({id,status}:{id:string;status:string})=>api(path+'/program-proposals/'+id,{status},'PATCH'),onSuccess:refresh});
 const remove=useMutation({mutationFn:(item:Item)=>api(path+'/program/'+item.id,{updatedAt:item.updatedAt},'DELETE'),onSuccess:()=>{setDeleting(null);refresh();}});
 const lock=useMutation({mutationFn:(item:Item)=>api(path+'/program/'+item.id+'/lock',{updatedAt:item.updatedAt,isLocked:!item.isLocked},'PATCH'),onSuccess:refresh});
 const reorder=useMutation({mutationFn:({a,b}:{a:Item;b:Item})=>{
  const day=query.data!.items.filter(x=>x.date===a.date);const from=day.findIndex(x=>x.id===a.id),to=day.findIndex(x=>x.id===b.id);if(from<0||to<0)throw new Error("Program item missing");day[from]=b;day[to]=a;
  return api(path+'/program/reorder',{items:day.map((item,i)=>({id:item.id,sortOrder:i,updatedAt:item.updatedAt}))},'PATCH');
 },onSuccess:refresh});
 if(query.isPending)return <section className="panel" role="status">Загружаем программу…</section>;
 if(query.isError)return <section className="notice error" role={query.error instanceof ApiError&&query.error.status===403?'status':'alert'}>{errorText(query.error)} <button onClick={()=>void query.refetch()}>Повторить</button></section>;
 const {items,conflicts,capabilities}=query.data;
 return <section className="panel program-panel"><h2>Программа смены</h2>
  {query.data.days.length>0&&<label className="field"><span>День программы</span><select value={query.data.date??''} onChange={e=>{setDate(e.target.value);setEditor(null);}}>{query.data.days.map(day=><option key={day} value={day}>{day}</option>)}</select></label>}
  {capabilities.create&&<button onClick={()=>setEditor('new')}>Добавить мероприятие</button>}
  {editor&&<ProgramEditor key={editor==='new'?'new':editor.id} shiftId={shiftId} item={editor==='new'?null:editor} fullEdit={capabilities.fullEdit} saved={nextDate=>{if(nextDate)setDate(nextDate);setEditor(null);refresh();}} close={()=>setEditor(null)}/>}
  {(remove.isError||lock.isError)&&<p role="alert">{errorText(remove.error??lock.error)} <button onClick={()=>void query.refetch()}>Обновить программу</button></p>}
  {(remove.isSuccess||lock.isSuccess)&&<p role="status">Изменение сохранено.</p>}
  {conflicts.length>0&&<p className="notice" role="status">Пересечения времени: {conflicts.length}. Они не запрещают сохранение.</p>}
  {reorder.isError&&<p className="notice error" role="alert">{errorText(reorder.error)} <button onClick={()=>void query.refetch()}>Обновить программу</button></p>}
  {reorder.isSuccess&&<p role="status">Порядок сохранён.</p>}
  {items.length===0&&<p>В программе пока нет мероприятий.</p>}
  {items.map((item,i)=>{const prev=items[i-1],next=items[i+1];return <article key={item.id}>
   {(i===0||prev?.date!==item.date)&&<h3>{item.date.slice(0,10)}</h3>}
   <h4>{item.startTime}–{item.endTime} · {item.title}</h4><p>{item.type==='EDUCATIONAL'?'Образовательное':'Досуговое'}{item.location?' · '+item.location:''}</p>
   {item.responsible&&<p>Ответственный: {item.responsible.firstName} {item.responsible.lastName}</p>}
   {item.isLocked&&<p>Пункт заблокирован</p>}
   {item.bankEvent&&<BankOriginal eventId={item.bankEvent.id}/>}
   <div className="form-actions">
    {item.capabilities.edit&&<button className="secondary" onClick={()=>setEditor(item)}>Редактировать: {item.title}</button>}
    {item.capabilities.lock&&<button className="secondary" disabled={lock.isPending} onClick={()=>lock.mutate(item)}>{item.isLocked?'Разблокировать':'Заблокировать'}: {item.title}</button>}
    {item.capabilities.manage&&!item.isLocked&&<button className="secondary" disabled={remove.isPending} onClick={()=>setDeleting(item.id)}>Удалить: {item.title}</button>}
   </div>
   {deleting===item.id&&<div className="notice"><p>Удалить мероприятие «{item.title}»?</p><button disabled={remove.isPending} onClick={()=>remove.mutate(item)}>Подтвердить удаление</button><button className="secondary" onClick={()=>setDeleting(null)}>Отмена</button></div>}
   {conflicts.some(c=>c.firstId===item.id||c.secondId===item.id)&&<p className="notice">Время пересекается с другим мероприятием.</p>}
   {capabilities.reorder&&<div className="form-actions"><button className="secondary" aria-label={'Выше: '+item.title} disabled={reorder.isPending||item.isLocked||!prev||prev.date!==item.date||items.some(x=>x.date===item.date&&x.isLocked)} onClick={()=>{if(prev)reorder.mutate({a:item,b:prev});}}>Выше</button><button className="secondary" aria-label={'Ниже: '+item.title} disabled={reorder.isPending||item.isLocked||!next||next.date!==item.date||items.some(x=>x.date===item.date&&x.isLocked)} onClick={()=>{if(next)reorder.mutate({a:item,b:next});}}>Ниже</button></div>}
  </article>;})}
  <ProgramHistory shiftId={shiftId}/><h3>Предложения изменений</h3>
  {capabilities.propose&&<form onSubmit={e=>{e.preventDefault();propose.mutate();}}><label className="field"><span>Предложить изменение</span><textarea required maxLength={5000} value={text} onChange={e=>setText(e.target.value)}/></label><button disabled={propose.isPending||!text.trim()}>Отправить предложение</button></form>}
  {propose.isError&&<p className="notice error" role="alert">{errorText(propose.error)}</p>}{propose.isSuccess&&<p role="status">Предложение отправлено.</p>}
  {decide.isError&&<p className="notice error" role="alert">{errorText(decide.error)}</p>}{decide.isSuccess&&<p role="status">Решение сохранено.</p>}
  {proposals.isPending?<p role="status">Загружаем предложения…</p>:proposals.isError?<div role="alert">{errorText(proposals.error)} <button onClick={()=>void proposals.refetch()}>Повторить</button></div>:<>
   {!proposals.data.items.length&&<p>Доступных предложений пока нет.</p>}
   {proposals.data.items.map(p=><article key={p.id}><p className="multiline">{p.text}</p><p>{p.status==='PENDING'?'Ожидает решения':p.status==='ACCEPTED'?'Принято':'Отклонено'}</p>{p.status==='PENDING'&&capabilities.decide&&<div className="form-actions"><button disabled={decide.isPending} onClick={()=>decide.mutate({id:p.id,status:'ACCEPTED'})}>Принять</button><button className="secondary" disabled={decide.isPending} onClick={()=>decide.mutate({id:p.id,status:'REJECTED'})}>Отклонить</button></div>}</article>)}
   {capabilities.decide&&<p className="muted">Решение по предложению сохраняется отдельно. Изменения программы вносятся вручную.</p>}
   <div className="pagination"><button className="secondary" disabled={page===1} onClick={()=>setPage(page-1)}>Назад</button><span>Страница {page}</span><button className="secondary" disabled={page*20>=proposals.data.total} onClick={()=>setPage(page+1)}>Далее</button></div>
  </>}
 </section>;
}

function ProgramEditor({shiftId,item,fullEdit,saved,close}:{shiftId:string;item:Item|null;fullEdit:boolean;saved:(date?:string)=>void;close:()=>void}) {
 const manager=!item||item.capabilities.manage;
 const [responsibleId,setResponsibleId]=useState(item?.responsibleId??'');const [staffSearch,setStaffSearch]=useState('');const [staffPage,setStaffPage]=useState(1);
 const [bank,setBank]=useState(item?.bankEventId??'');const [title,setTitle]=useState(item?.title??'');const [description,setDescription]=useState(item?.description??'');
 const [search,setSearch]=useState('');const [bankPage,setBankPage]=useState(1);const [type,setType]=useState(item?.type??(fullEdit?'EDUCATIONAL':'ENTERTAINMENT'));
 const candidates=useQuery({queryKey:['program-candidates',shiftId,staffSearch,staffPage],queryFn:()=>api<{items:Array<{id:string;firstName:string;lastName:string|null}>;total:number}>('/shifts/'+shiftId+'/program-candidates?page='+staffPage+'&search='+encodeURIComponent(staffSearch)),enabled:manager});
 const events=useQuery({queryKey:['program-bank',search,bankPage],queryFn:()=>api<{items:Array<{id:string;title:string;description:string|null;category:string}>;total:number}>('/bank-events?search='+encodeURIComponent(search)+'&page='+bankPage)});
 const [original,setOriginal]=useState(item?.bankEventId??'');
 const mutation=useMutation({mutationFn:(data:object)=>api('/shifts/'+shiftId+'/program'+(item?'/'+item.id:''),data,item?'PATCH':'POST'),onSuccess:(_data,body)=>{saved('date' in body&&typeof body.date==='string'?body.date:undefined);}});
 return <form className="panel" onSubmit={e=>{
  e.preventDefault();const f=new FormData(e.currentTarget);const body={title,description,location:String(f.get('location')??''),startTime:String(f.get('startTime')),endTime:String(f.get('endTime')),...(manager?{date:String(f.get('date')),type,...(!item||responsibleId!==(item.responsibleId??'')?{responsibleId:responsibleId||null}:{})}:{}),...(bank!==original||!item?{bankEventId:bank||null}:{}),...(item?{updatedAt:item.updatedAt}:{sortOrder:0})};
  mutation.mutate(body);
 }}><h3>{item?'Редактирование мероприятия':'Новое мероприятие'}</h3>
  <label className="field"><span>Название мероприятия</span><input required maxLength={200} value={title} onChange={e=>setTitle(e.target.value)}/></label>
  <label className="field"><span>Описание мероприятия</span><textarea maxLength={10000} value={description} onChange={e=>setDescription(e.target.value)}/></label>
  {manager&&<label className="field"><span>Дата мероприятия</span><input name="date" type="date" required defaultValue={item?.date.slice(0,10)}/></label>}
  <div className="two-columns"><label className="field"><span>Начало мероприятия</span><input required name="startTime" type="time" defaultValue={item?.startTime}/></label><label className="field"><span>Окончание мероприятия</span><input required name="endTime" type="time" defaultValue={item?.endTime}/></label></div>
  <label className="field"><span>Локация мероприятия</span><input name="location" maxLength={200} defaultValue={item?.location??''}/></label>
  {manager&&<><label className="field"><span>Тип мероприятия</span><select disabled={!fullEdit} value={type} onChange={e=>setType(e.target.value)}><option value="EDUCATIONAL">Образовательное</option><option value="ENTERTAINMENT">Досуговое</option></select></label>
  <label className="field"><span>Поиск ответственного</span><input value={staffSearch} onChange={e=>{setStaffSearch(e.target.value);setStaffPage(1);}}/></label>
  <label className="field"><span>Ответственный мероприятия</span><select aria-label="Ответственный мероприятия" name="responsibleId" value={responsibleId} onChange={e=>setResponsibleId(e.target.value)} disabled={candidates.isPending||candidates.isError}><option value="">Не назначен</option>{responsibleId&&!candidates.data?.items.some(c=>c.id===responsibleId)&&<option value={responsibleId}>{item?.responsible?.firstName??'Выбранный сотрудник'} {item?.responsible?.lastName}</option>}{candidates.data?.items.map(c=><option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}</select></label>
  <div className="pagination"><button type="button" disabled={staffPage===1} onClick={()=>setStaffPage(staffPage-1)}>Предыдущие сотрудники</button><button type="button" disabled={!candidates.data||staffPage*20>=candidates.data.total} onClick={()=>setStaffPage(staffPage+1)}>Следующие сотрудники</button></div>
  {candidates.isError&&<p role="alert">{errorText(candidates.error)} <button type="button" onClick={()=>void candidates.refetch()}>Повторить загрузку сотрудников</button></p>}</>}
  <label className="field"><span>Поиск в банке мероприятий</span><input value={search} onChange={e=>{setSearch(e.target.value);setBankPage(1);}}/></label>
  <label className="field"><span>Источник из банка</span><select aria-label="Источник из банка" value={bank} onChange={e=>{setOriginal(item?.bankEventId??'');setBank(e.target.value);const event=events.data?.items.find(x=>x.id===e.target.value);if(event){setTitle(event.title);setDescription(event.description??'');if(fullEdit)setType(event.category==='ENTERTAINMENT'?'ENTERTAINMENT':'EDUCATIONAL');}}}><option value="">Без привязки</option>{bank&&!events.data?.items.some(x=>x.id===bank)&&<option value={bank}>{item?.bankEvent?.title??'Выбранный оригинал'}</option>}{events.data?.items.map(e=><option value={e.id} key={e.id}>{e.title}</option>)}</select></label>
  {events.isPending&&<p role="status">Загружаем банк…</p>}{events.isError&&<p role="alert">{errorText(events.error)} <button type="button" onClick={()=>void events.refetch()}>Повторить загрузку банка</button></p>}
  <div className="pagination"><button type="button" disabled={bankPage===1} onClick={()=>setBankPage(bankPage-1)}>Предыдущие материалы</button><button type="button" disabled={!events.data||bankPage*20>=events.data.total} onClick={()=>setBankPage(bankPage+1)}>Следующие материалы</button></div>
  {mutation.isError&&<p role="alert">{errorText(mutation.error)}</p>}
  <div className="form-actions"><button disabled={mutation.isPending||(manager&&(candidates.isPending||candidates.isError))}>Сохранить мероприятие</button><button type="button" className="secondary" disabled={mutation.isPending} onClick={close}>Закрыть форму</button></div>
 </form>;
}
function BankOriginal({eventId}:{eventId:string}) {
 const [open,setOpen]=useState(false);const query=useQuery({queryKey:['bank-original',eventId],queryFn:()=>api<{event:{title:string;description:string|null;materials:string|null}}>('/bank-events/'+eventId),enabled:open});
 return <div><button className="text-button" onClick={()=>setOpen(!open)}>{open?'Закрыть оригинал':'Открыть оригинал из банка'}</button>{open&&(query.isPending?<p role="status">Загружаем оригинал…</p>:query.isError?<p role="alert">{errorText(query.error)} <button onClick={()=>void query.refetch()}>Повторить</button></p>:<div><h4>{query.data.event.title}</h4><p className="multiline">{query.data.event.description}</p><p className="multiline">{query.data.event.materials}</p></div>)}</div>;
}
function ProgramHistory({shiftId}:{shiftId:string}) {
 const [open,setOpen]=useState(false),[page,setPage]=useState(1);
 const query=useQuery({queryKey:['program-history',shiftId,page],queryFn:()=>api<{items:Array<{id:string;action:string;createdAt:string;actor:{firstName:string;lastName:string|null}}> ;total:number}>('/shifts/'+shiftId+'/program-history?page='+page),enabled:open});
 const labels:Record<string,string>={PROGRAM_ITEM_CREATED:'Мероприятие создано',PROGRAM_ITEM_UPDATED:'Мероприятие изменено',PROGRAM_ITEM_DELETED:'Мероприятие удалено',PROGRAM_ITEM_LOCKED:'Мероприятие заблокировано',PROGRAM_ITEM_UNLOCKED:'Мероприятие разблокировано',PROGRAM_REORDERED:'Порядок изменён'};
 return <div><button className="secondary" onClick={()=>setOpen(!open)}>История программы</button>{open&&(query.isPending?<p role="status">Загружаем историю…</p>:query.isError?<p role="alert">{errorText(query.error)} <button onClick={()=>void query.refetch()}>Повторить</button></p>:<><ul>{query.data.items.map(x=><li key={x.id}>{labels[x.action]??'Программа изменена'} · {x.actor.firstName} {x.actor.lastName} · {new Date(x.createdAt).toLocaleString('ru-RU')}</li>)}</ul>{!query.data.items.length&&<p>История пока пуста.</p>}<div className="pagination"><button disabled={page===1} onClick={()=>setPage(page-1)}>Назад по истории</button><button disabled={page*20>=query.data.total} onClick={()=>setPage(page+1)}>Далее по истории</button></div></>)}</div>;
}
