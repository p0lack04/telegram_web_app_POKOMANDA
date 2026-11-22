import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {api} from './api';
import {BankFiles} from './BankFiles';
import type {Page} from './types';

type Event={id:string;title:string;description:string|null;category:string;tags:string[];isPublic:boolean;capabilities:{edit:boolean}};
const categories:Record<string,string>={FIVE_MIN:'Пятиминутка',ICEBREAKER:'Знакомство',EDUCATIONAL:'Образовательное',ENTERTAINMENT:'Досуговое'};
const errorText=(error:unknown)=>error instanceof Error?error.message:'Не удалось выполнить запрос';
export default function Bank(){
 const client=useQueryClient();const [search,setSearch]=useState('');const [page,setPage]=useState(1);const [title,setTitle]=useState('');const [editing,setEditing]=useState<Event|null>(null);
 const query=useQuery({queryKey:['bank',search,page],queryFn:()=>api<Page<Event>>(`/bank-events?search=${encodeURIComponent(search)}&page=${page}&pageSize=20`),retry:false});
 const refresh=()=>client.invalidateQueries({queryKey:['bank']});
 const create=useMutation({mutationFn:()=>api('/bank-events',{title,category:'EDUCATIONAL',tags:[],isPublic:true}),onSuccess:async()=>{setTitle('');setPage(1);await refresh();}});
 if(query.isPending)return <p role="status">Загружаем банк мероприятий…</p>;
 if(query.isError)return <div role="alert" className="notice error"><p>{errorText(query.error)}</p><button onClick={()=>void query.refetch()}>Повторить</button></div>;
 return <><label className="field"><span>Поиск мероприятий</span><input aria-label="Поиск" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/></label>
 <form className="panel" onSubmit={e=>{e.preventDefault();create.mutate();}}><label className="field"><span>Новое мероприятие</span><input required maxLength={200} value={title} onChange={e=>setTitle(e.target.value)}/></label><button disabled={create.isPending}>{create.isPending?'Сохраняем…':'Добавить в банк'}</button>{create.isError&&<p role="alert">{errorText(create.error)}</p>}{create.isSuccess&&<p role="status">Мероприятие добавлено.</p>}</form>
 {query.data.items.length===0?<p className="empty">Мероприятий пока нет.</p>:query.data.items.map(event=><section className="panel" key={event.id}><span className="status">{categories[event.category]??event.category} · {event.isPublic?'Общий материал':'Закрытый материал'}</span><h2>{event.title}</h2>{event.description&&<p className="multiline">{event.description}</p>}<small>{event.tags.join(', ')}</small>{event.capabilities.edit&&<button className="secondary" onClick={()=>setEditing(event)}>Редактировать мероприятие банка</button>}{editing?.id===event.id&&event.capabilities.edit&&<Editor key={event.id} event={editing} close={()=>setEditing(null)} saved={refresh}/>}<BankFiles eventId={event.id}/></section>)}
 <nav className="pagination" aria-label="Страницы банка"><button className="secondary" disabled={page===1} onClick={()=>setPage(p=>p-1)}>Назад</button><span>Страница {page}</span><button className="secondary" disabled={page*20>=query.data.total} onClick={()=>setPage(p=>p+1)}>Далее</button></nav></>;
}
function Editor({event,close,saved}:{event:Event;close:()=>void;saved:()=>Promise<unknown>}){
 const [title,setTitle]=useState(event.title);const [description,setDescription]=useState(event.description??'');const [isPublic,setPublic]=useState(event.isPublic);
 const mutation=useMutation({mutationFn:()=>api(`/bank-events/${event.id}`,{title,description,isPublic},'PATCH'),onSuccess:async()=>{await saved();close();}});
 return <form onSubmit={e=>{e.preventDefault();mutation.mutate();}}><fieldset disabled={mutation.isPending}><label className="field"><span>Название материала банка</span><input required maxLength={200} value={title} onChange={e=>setTitle(e.target.value)}/></label><label className="field"><span>Описание материала банка</span><textarea maxLength={10000} value={description} onChange={e=>setDescription(e.target.value)}/></label><label className="checkbox"><input type="checkbox" checked={isPublic} onChange={e=>setPublic(e.target.checked)}/>Общий материал</label><button>Сохранить материал банка</button><button className="secondary" type="button" onClick={close}>Отмена редактирования материала</button></fieldset>{mutation.isError&&<p role="alert">{errorText(mutation.error)}</p>}</form>;
}
