import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {api,ApiError} from './api';
import {type Page,type Squad} from './types';

const pageSize=20;
export const squadKeys={list:(shiftId:string,page:number)=>['squads',shiftId,'list',page] as const,detail:(shiftId:string,squadId:string)=>['squads',shiftId,'detail',squadId] as const};
export function safeSquadColor(color:string|null):string|undefined {return typeof color==='string' && /^#[\da-f]{6}$/i.test(color)?color:undefined;}
function Color({color}:{color:string|null}){return <span className="squad-color" style={{backgroundColor:safeSquadColor(color)??'var(--accent)'}} aria-hidden="true"/>;}
function Failure({error,retry}:{error:unknown;retry:()=>void}){
 const status=error instanceof ApiError?error.status:0;
 return <div className="notice error" role="alert"><strong>{status===403?'Нет доступа к отрядам':status===404?'Отряд или смена не найдены':'Не удалось загрузить отряды'}</strong><p>{status===403?'Доступ к этим данным ограничен.':status===404?'Данные недоступны или были удалены.':'Проверьте подключение и повторите запрос.'}</p><button className="secondary" onClick={retry}>Повторить</button></div>;
}
function Loading(){return <p role="status" aria-live="polite">Загружаем отряды…</p>;}
export function Squads({shiftId,open}:{shiftId:string;open:(id:string)=>void}){
 const [page,setPage]=useState(1);
 const query=useQuery({queryKey:squadKeys.list(shiftId,page),queryFn:()=>api<Page<Squad>>(`/shifts/${encodeURIComponent(shiftId)}/squads?page=${page}&pageSize=${pageSize}`),retry:false});
 return <section aria-labelledby="squads-heading"><div className="section-heading"><h2 id="squads-heading">Отряды</h2></div>{query.isError?<Failure error={query.error} retry={()=>void query.refetch()}/>:query.isPending?<Loading/>:<>{query.data.items.length===0?<div className="empty"><p>Доступных отрядов пока нет.</p></div>:<div className="shift-list">{query.data.items.map(squad=><button className="shift-card" key={squad.id} aria-label={squad.name} onClick={()=>open(squad.id)}><Color color={squad.color}/><span className="shift-summary"><strong>{squad.name}</strong><small>Порядок: {squad.sortOrder}</small><small>Цвет: {safeSquadColor(squad.color)??'не указан'}</small></span><span aria-hidden="true">→</span></button>)}</div>}<nav className="pagination squad-pagination" aria-label="Страницы отрядов"><button className="secondary" disabled={page===1} onClick={()=>setPage(p=>p-1)}>Назад</button><span>Страница {page}</span><button className="secondary" disabled={page*pageSize>=query.data.total} onClick={()=>setPage(p=>p+1)}>Далее</button></nav></>}</section>;
}
export function SquadDetail({shiftId,squadId}:{shiftId:string;squadId:string}){
 const query=useQuery({queryKey:squadKeys.detail(shiftId,squadId),queryFn:()=>api<{squad:Squad}>(`/shifts/${encodeURIComponent(shiftId)}/squads/${encodeURIComponent(squadId)}`),retry:false});
 if(query.isError)return <Failure error={query.error} retry={()=>void query.refetch()}/>;
 if(query.isPending)return <Loading/>;
 const squad=query.data.squad;
 return <section className="panel"><Color color={squad.color}/><h2>{squad.name}</h2><dl><dt>Цвет</dt><dd>{safeSquadColor(squad.color)??'Не указан'}</dd><dt>Порядок</dt><dd>{squad.sortOrder}</dd></dl></section>;
}
