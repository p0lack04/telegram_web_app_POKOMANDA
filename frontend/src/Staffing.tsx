import {useEffect,useRef,useState,type FormEvent,type ReactNode} from 'react';
import {useMutation,useQuery,useQueryClient,type QueryClient} from '@tanstack/react-query';
import {api} from './api';
import {type Application,type Assignment,type History,type Notification,type Page,type Shift,type Staff,type StaffingInfo,type UserSummary,roles,stages,dateLabel,fullName} from './types';

export const applicationStatuses={PENDING:'На рассмотрении',APPROVED:'Одобрена',REJECTED:'Отклонена'};
const applicationTypes={LEAD_RECRUIT:'Ведущий',TRAINEE_RECRUIT:'Стажёр'};
export function recruitmentFor(shift:Pick<Shift,'leadRecruitOpen'|'traineeRecruitOpen'>,role:UserSummary['role']) {
 return role==='LEAD'?{type:'LEAD_RECRUIT' as const,open:shift.leadRecruitOpen}:role==='TRAINEE'?{type:'TRAINEE_RECRUIT' as const,open:shift.traineeRecruitOpen}:null;
}
export function allowedPositions(positions:string[],role:UserSummary['role']) {return positions.filter(position=>role==='ADMIN'||position!=='Руководитель');}
const errorMessage=(error:unknown)=>error instanceof Error?error.message:'Не удалось выполнить запрос';
const queryGroups=['shifts','shift','staffing','applications','staff','roles','history','own','notifications','staff-candidates'];
async function refreshStaffing(client:QueryClient) {await Promise.all(queryGroups.map(key=>client.invalidateQueries({queryKey:[key]})));}
function Failure({error,retry}:{error:unknown;retry?:()=>void}) {return <div className="notice error" role="alert"><p>{errorMessage(error)}</p>{retry&&<button className="secondary" onClick={retry}>Повторить</button>}</div>;}
function Feedback({pending,error,success}:{pending:boolean;error:unknown;success:boolean}) {return <>{pending&&<p role="status">Сохраняем изменения…</p>}{error&&<Failure error={error}/ >}{success&&<p className="notice" role="status">Изменения сохранены.</p>}</>;}
function usePage<T>(key:readonly unknown[],path:string,enabled=true) {
 const [page,setPage]=useState(1);
 const query=useQuery({queryKey:[...key,page],queryFn:()=>api<Page<T>>(`${path}${path.includes('?')?'&':'?'}page=${page}&pageSize=20`),enabled});
 return {query,page,setPage};
}
function PagedList<T>({resource,empty,children}:{resource:ReturnType<typeof usePage<T>>;empty:string;children:(item:T)=>ReactNode}) {
 const {query,page,setPage}=resource;
 if(query.isPending)return <p role="status">Загружаем список…</p>;
 if(query.isError)return <Failure error={query.error} retry={()=>void query.refetch()}/>;
 return <>{query.data.items.length?<ul className="staffing-list">{query.data.items.map(children)}</ul>:<p className="empty">{empty}</p>}{(query.data.total>20||page>1)&&<div className="pagination"><button className="secondary" disabled={page===1||query.isFetching} onClick={()=>setPage(page-1)}>Назад</button><span>Страница {page}</span><button className="secondary" disabled={page*query.data.pageSize>=query.data.total||query.isFetching} onClick={()=>setPage(page+1)}>Далее</button></div>}</>;
}
function ApplicationSummary({application,showUser=false}:{application:Application;showUser?:boolean}) {return <><strong>{showUser?fullName(application.user):application.shift.title}</strong><p className="muted">{applicationTypes[application.type]} · {stages[application.shift.stage]}</p><span className="status">{applicationStatuses[application.status]}</span><small className="record-date">Подана {dateLabel(application.createdAt)}</small></>;}

export default function Staffing({shift,user}:{shift:Shift;user:UserSummary}) {
 const info=useQuery({queryKey:['staffing',shift.id],queryFn:()=>api<StaffingInfo>(`/shifts/${shift.id}/staffing`)});
 if(info.isPending)return <section className="panel"><h2>Команда смены</h2><p role="status">Проверяем доступ…</p></section>;
 if(info.isError)return <section className="panel"><h2>Команда смены</h2><Failure error={info.error} retry={()=>void info.refetch()}/></section>;
 return <div className="staffing"><Applications shift={shift} user={user} info={info.data}/>{user.role==='ADMIN'&&info.data.canReview&&<Recruitment key={shift.id} shift={shift}/>}<StaffAndRoles shift={shift} user={user} info={info.data}/><StaffingHistory shiftId={shift.id} canManage={info.data.canManageRoles||info.data.canReview}/></div>;
}
function Applications({shift,user,info}:{shift:Shift;user:UserSummary;info:StaffingInfo}) {
 const client=useQueryClient();
 const resource=usePage<Application>(['applications',shift.id],`/shifts/${shift.id}/applications`);
 const [decision,setDecision]=useState<{application:Application;status:'APPROVED'|'REJECTED'}|null>(null);
 const apply=useMutation({mutationFn:(type:Application['type'])=>api(`/shifts/${shift.id}/applications`,{type}),onSuccess:()=>refreshStaffing(client)});
 const review=useMutation({mutationFn:({application,status}:{application:Application;status:'APPROVED'|'REJECTED'})=>api(`/applications/${application.id}`,{status,version:application.version},'PATCH'),onSuccess:()=>{setDecision(null);return refreshStaffing(client);},onError:()=>{setDecision(null);void refreshStaffing(client);}});
 const recruitment=recruitmentFor(shift,user.role);
 const ownApplication=resource.query.data?.items.find(item=>item.userId===user.id);
 const canReview=info.canReview&&user.role==='ADMIN';
 return <section className="panel"><h2>{canReview?'Заявки на смену':'Моя заявка на смену'}</h2><p className="muted">Одобрение заявки даёт допуск к смене. Должности назначаются отдельно; закрытые заявки не пересматриваются.</p>{recruitment&&<><p className="muted">Набор {user.role==='LEAD'?'ведущих':'стажёров'} {recruitment.open?'открыт':'закрыт'}. Текущий этап: {stages[shift.stage]}. Подача заявки зависит от открытого набора, а не от этапа.</p>{!ownApplication&&resource.query.isSuccess&&<button disabled={!recruitment.open||apply.isPending||apply.isSuccess} onClick={()=>apply.mutate(recruitment.type)}>{apply.isPending?'Отправляем…':'Подать заявку'}</button>}</>}
 <Feedback pending={apply.isPending||review.isPending} error={apply.error||review.error} success={apply.isSuccess||review.isSuccess}/>
 <PagedList resource={resource} empty={canReview?'Заявок пока нет.':'Вы ещё не подавали заявку на эту смену.'}>{application=><li key={application.id}><ApplicationSummary application={application} showUser={canReview}/>{canReview&&application.status==='PENDING'&&(decision?.application.id===application.id?<div className="notice"><p>{decision.status==='APPROVED'?'Одобрить':'Отклонить'} заявку {fullName(application.user)}? Будет сохранено решение для версии {decision.application.version}.</p><div className="form-actions"><button disabled={review.isPending} onClick={()=>review.mutate(decision)}>Подтвердить решение</button><button className="secondary" disabled={review.isPending} onClick={()=>setDecision(null)}>Отмена</button></div></div>:<div className="form-actions"><button disabled={review.isPending} onClick={()=>{review.reset();setDecision({application,status:'APPROVED'});}}>Одобрить</button><button className="secondary danger" disabled={review.isPending} onClick={()=>{review.reset();setDecision({application,status:'REJECTED'});}}>Отклонить</button></div>)}</li>}</PagedList>
 </section>;
}
function Recruitment({shift}:{shift:Shift}) {
 const client=useQueryClient();const [stage,setStage]=useState(shift.stage);const [lead,setLead]=useState(shift.leadRecruitOpen);const [trainee,setTrainee]=useState(shift.traineeRecruitOpen);
 useEffect(()=>{setStage(shift.stage);setLead(shift.leadRecruitOpen);setTrainee(shift.traineeRecruitOpen);},[shift.stage,shift.leadRecruitOpen,shift.traineeRecruitOpen]);
 const mutation=useMutation({mutationFn:()=>api(`/shifts/${shift.id}/recruitment`,{stage,leadRecruitOpen:lead,traineeRecruitOpen:trainee},'PATCH'),onSuccess:()=>refreshStaffing(client)});
 return <section className="panel"><h2>Этап и набор</h2><form onSubmit={event=>{event.preventDefault();mutation.mutate();}}><fieldset disabled={mutation.isPending}><label className="field"><span>Этап смены</span><select aria-label="Этап смены" value={stage} onChange={event=>setStage(event.target.value as Shift['stage'])}>{Object.entries(stages).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="checkbox"><input type="checkbox" checked={lead} onChange={event=>setLead(event.target.checked)}/>Открыть набор ведущих</label><label className="checkbox"><input type="checkbox" checked={trainee} onChange={event=>setTrainee(event.target.checked)}/>Открыть набор стажёров</label><button>Сохранить параметры</button></fieldset><Feedback pending={mutation.isPending} error={mutation.error} success={mutation.isSuccess}/></form></section>;
}
function StaffAndRoles({shift,user,info}:{shift:Shift;user:UserSummary;info:StaffingInfo}) {
 const client=useQueryClient();
 const staff=usePage<Staff>(['staff',shift.id],`/shifts/${shift.id}/staff`,info.canManageRoles);
 const assignments=usePage<Assignment>(['roles',shift.id],`/shifts/${shift.id}/roles`);
 const [selected,setSelected]=useState<UserSummary|null>(null);const [removing,setRemoving]=useState<Assignment|null>(null);
 const remove=useMutation({mutationFn:(assignment:Assignment)=>api<void>(`/shifts/${shift.id}/roles/${assignment.id}`,{},'DELETE'),onSuccess:()=>{setRemoving(null);return refreshStaffing(client);},onError:()=>void refreshStaffing(client)});
 return <>{info.canManageRoles&&<section className="panel"><h2>Педсостав смены</h2><PagedList resource={staff} empty="В педсостав пока никто не добавлен.">{person=><li key={person.id}><strong>{fullName(person)}</strong><p className="muted">{roles[person.role]}</p>{person.positions.length>0?<ul className="position-list">{person.positions.map(position=><li key={position.id}>{position.position}{position.squadId&&` · ${info.squads.find(squad=>squad.id===position.squadId)?.name??'Отряд'}`}</li>)}</ul>:<p className="muted">Должности не назначены</p>}{info.canManageRoles&&<button className="secondary" aria-pressed={selected?.id===person.id} onClick={()=>setSelected(person)}>Назначить должность</button>}</li>}</PagedList>{user.role==='ADMIN'&&info.canReview&&<CandidateSearch shiftId={shift.id}/>}</section>}
 <section className="panel"><h2>{info.canManageRoles?'Должности на смене':'Мои должности на смене'}</h2>{info.canManageRoles&&(selected?<AssignRole key={selected.id} shiftId={shift.id} person={selected} info={info} currentRole={user.role} cancel={()=>setSelected(null)}/>:<p className="muted">Выберите участника в списке педсостава выше для назначения должности.</p>)}
 <Feedback pending={remove.isPending} error={remove.error} success={remove.isSuccess}/>
 <PagedList resource={assignments} empty="Назначений пока нет.">{assignment=><li key={assignment.id}><strong>{assignment.position}</strong><p>{fullName(assignment.user)}</p><p className="muted">{assignment.squadId?`Отряд: ${info.squads.find(squad=>squad.id===assignment.squadId)?.name??'Название недоступно'}`:'Без привязки к отряду'}</p>{info.canManageRoles&&(user.role==='ADMIN'||assignment.position!=='Руководитель')&&(removing?.id===assignment.id?<div className="notice"><p>Снять должность «{assignment.position}» у {fullName(assignment.user)}?</p><div className="form-actions"><button className="secondary danger" disabled={remove.isPending} onClick={()=>remove.mutate(assignment)}>Подтвердить снятие</button><button className="secondary" disabled={remove.isPending} onClick={()=>setRemoving(null)}>Отмена</button></div></div>:<button className="secondary danger" disabled={remove.isPending} onClick={()=>{remove.reset();setRemoving(assignment);}}>Снять должность</button>)}</li>}</PagedList></section></>;
}
function AssignRole({shiftId,person,info,currentRole,cancel}:{shiftId:string;person:UserSummary;info:StaffingInfo;currentRole:UserSummary['role'];cancel:()=>void}) {
 const client=useQueryClient();const positions=allowedPositions(info.positions,currentRole);const [position,setPosition]=useState('');const [squadId,setSquad]=useState('');const selectRef=useRef<HTMLSelectElement>(null);
 useEffect(()=>{selectRef.current?.focus();},[]);
 const assign=useMutation({mutationFn:()=>api(`/shifts/${shiftId}/roles`,{userId:person.id,position,...(squadId?{squadId}:{})}),onSuccess:()=>refreshStaffing(client)});
 return <form className="assignment-form" onSubmit={event=>{event.preventDefault();assign.mutate();}}><p>Назначение для <strong>{fullName(person)}</strong></p><fieldset disabled={assign.isPending}><label className="field"><span>Должность</span><select aria-label="Должность" ref={selectRef} required value={position} onChange={event=>{assign.reset();setPosition(event.target.value);}}><option value="">Выберите должность</option>{positions.map(item=><option key={item} value={item}>{item}</option>)}</select></label><label className="field"><span>Отряд (необязательно)</span><select aria-label="Отряд (необязательно)" value={squadId} onChange={event=>{assign.reset();setSquad(event.target.value);}}><option value="">Без привязки к отряду</option>{info.squads.map(squad=><option key={squad.id} value={squad.id}>{squad.name}</option>)}</select><small>Для привязки участник уже должен состоять в выбранном отряде. Сервер проверит членство.</small></label><div className="form-actions"><button disabled={!position||positions.length===0||assign.isSuccess}>Назначить</button><button type="button" className="secondary" onClick={cancel}>Закрыть форму</button></div></fieldset>{positions.length===0&&<p className="notice">Нет доступных для назначения должностей.</p>}<Feedback pending={assign.isPending} error={assign.error} success={assign.isSuccess}/></form>;
}
function CandidateSearch({shiftId}:{shiftId:string}) {
 const client=useQueryClient();const [input,setInput]=useState('');const [search,setSearch]=useState('');
 const add=useMutation({mutationFn:(userId:string)=>api(`/shifts/${shiftId}/staff`,{userId}),onSuccess:()=>refreshStaffing(client)});
 const submit=(event:FormEvent)=>{event.preventDefault();if(input.trim().length>=2){add.reset();setSearch(input.trim());}};
 return <div className="candidate-search"><h3>Добавить участника вручную</h3><form onSubmit={submit}><label className="field"><span>Поиск участника</span><input value={input} minLength={2} maxLength={100} required onChange={event=>setInput(event.target.value)} placeholder="Не менее двух символов"/><small>Только активные ведущие и стажёры, которым доступна смена и у которых ещё нет заявки на неё.</small></label><button className="secondary" disabled={input.trim().length<2||add.isPending}>Найти</button></form><Feedback pending={add.isPending} error={add.error} success={add.isSuccess}/>{search&&<CandidateResults key={search} shiftId={shiftId} search={search} pending={add.isPending} add={id=>add.mutate(id)}/>}</div>;
}
function CandidateResults({shiftId,search,pending,add}:{shiftId:string;search:string;pending:boolean;add:(id:string)=>void}) {
 const candidates=usePage<UserSummary>(['staff-candidates',shiftId,search],`/shifts/${shiftId}/staff-candidates?search=${encodeURIComponent(search)}`);
 return <><p className="muted">Результаты по запросу «{search}»</p><PagedList resource={candidates} empty="Подходящие участники не найдены.">{candidate=><li key={candidate.id}><strong>{fullName(candidate)}</strong><p className="muted">{roles[candidate.role]}</p><button disabled={pending} onClick={()=>add(candidate.id)}>Добавить в педсостав</button></li>}</PagedList></>;
}
const historyActions:Record<string,string>={APPLICATION_SUBMIT:'Заявка подана',POSITION_ASSIGNED:'Должность назначена',POSITION_REMOVED:'Должность снята',APPLICATION_CREATED:'Заявка подана',APPLICATION_APPROVED:'Заявка одобрена',APPLICATION_REJECTED:'Заявка отклонена',APPLICATION_REVIEWED:'Решение по заявке',STAFF_ADDED:'Участник добавлен',ROLE_ASSIGNED:'Должность назначена',ROLE_REMOVED:'Должность снята',RECRUITMENT_UPDATED:'Параметры набора изменены',STAGE_CHANGED:'Этап смены изменён'};
function StaffingHistory({shiftId,canManage}:{shiftId:string;canManage:boolean}) {
 const history=usePage<History>(['history',shiftId],`/shifts/${shiftId}/staffing-history`);
 return <section className="panel"><h2>{canManage?'История набора и назначений':'Моя история на смене'}</h2><PagedList resource={history} empty="История пока пуста.">{item=><li key={item.id}><strong>{historyActions[item.action]??item.action}</strong><p className="muted">{dateLabel(item.createdAt)} · {fullName(item.actor)}</p>{item.subject&&<p>Участник: {fullName(item.subject)}</p>}{item.details.position&&<p>Должность: {item.details.position}</p>}{item.details.status&&<p>Статус: {applicationStatuses[item.details.status as Application['status']]??item.details.status}</p>}{item.details.from&&<p>До: {applicationStatuses[item.details.from as Application['status']]??stages[item.details.from as Shift['stage']]??item.details.from}</p>}{item.details.to&&<p>После: {applicationStatuses[item.details.to as Application['status']]??stages[item.details.to as Shift['stage']]??item.details.to}</p>}</li>}</PagedList></section>;
}
export function OwnStaffing() {
 const applications=usePage<Application>(['own','applications'],'/me/applications');
 const assignments=usePage<Assignment>(['own','assignments'],'/me/assignments');
 return <><section className="panel"><h2>Мои заявки</h2><PagedList resource={applications} empty="Вы ещё не подавали заявки на смены.">{application=><li key={application.id}><ApplicationSummary application={application}/></li>}</PagedList></section><section className="panel"><h2>Мои назначения</h2><PagedList resource={assignments} empty="Должности на сменах пока не назначены.">{assignment=><li key={assignment.id}><strong>{assignment.position}</strong><p>{assignment.shift?.title??'Смена недоступна'}{assignment.shift&&` · ${stages[assignment.shift.stage]}`}</p><small>Назначено {dateLabel(assignment.createdAt)}</small></li>}</PagedList></section><NotificationInbox/></>;
}
function NotificationInbox() {
 const client=useQueryClient();const notifications=usePage<Notification>(['notifications'],'/me/notifications');
 const read=useMutation({mutationFn:(id:string)=>api(`/me/notifications/${id}/read`,{}),onSuccess:()=>client.invalidateQueries({queryKey:['notifications']})});
 return <section className="panel"><h2>Уведомления</h2><p className="muted">Внутренние уведомления приложения. Это не подтверждение доставки через Telegram.</p><Feedback pending={read.isPending} error={read.error} success={read.isSuccess}/><PagedList resource={notifications} empty="Уведомлений пока нет.">{notification=><li key={notification.id} className={notification.readAt?'':'unread'}><span className="status">{notification.readAt?'Прочитано':'Новое'}</span><p className="multiline">{notification.text}</p><small className="record-date">{dateLabel(notification.createdAt)}</small>{!notification.readAt&&<button className="secondary" disabled={read.isPending} onClick={()=>read.mutate(notification.id)}>Отметить прочитанным</button>}</li>}</PagedList></section>;
}
