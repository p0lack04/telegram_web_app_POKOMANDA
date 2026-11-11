import {useCallback,useState,type FormEvent,type ReactNode} from 'react';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {api,ApiError} from './api';
import {telegram,useTelegram} from './telegram';
import {type User,type Shift,type Page,roles,stages,visibility,dateLabel,fullName} from './types';

const message=(error:unknown)=>error instanceof Error?error.message:'Не удалось выполнить действие';
function Notice({error,retry}:{error:unknown;retry?:()=>void}) {return <div className="notice error" role="alert"><strong>Не удалось выполнить действие</strong><p>{message(error)}</p>{retry&&<button className="secondary" onClick={retry}>Повторить</button>}</div>;}
function Loading(){return <div role="status" aria-live="polite" className="loading"><span className="skeleton"/><span className="skeleton"/><span className="skeleton"/><p>Загружаем рабочее пространство…</p></div>;}
function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}){return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>;}
function Brand(){return <a className="brand" href="#"><span className="brand-mark" aria-hidden="true">К</span><span>команда<small>педагогический отряд</small></span></a>;}
async function authenticate():Promise<User|null>{
 try{return (await api<{user:User}>('/auth/me')).user;}
 catch(error){
  if(!(error instanceof ApiError) || error.status!==401) throw error;
  const initData=telegram()?.initData;if(!initData)return null;
  return (await api<{user:User}>('/auth/telegram',{initData})).user;
 }
}
export default function App(){
 const client=useQueryClient();
 const auth=useQuery({queryKey:['session'],queryFn:authenticate,retry:false,staleTime:Infinity,refetchOnWindowFocus:false});
 const [route,setRoute]=useState<'home'|'shifts'|'profile'|'team'>('home');
 const [selected,setSelected]=useState<Shift|null>(null);
 const [creating,setCreating]=useState(false);
 const back=useCallback(()=>{setSelected(null);setCreating(false);},[]);
 useTelegram(selected||creating?back:undefined);
 const logout=useMutation({mutationFn:()=>api<void>('/auth/logout',{}),onSuccess:()=>{client.clear();client.setQueryData(['session'],null);setSelected(null);setRoute('home');}});
 if(auth.isPending)return <main className="gate"><Brand/><Loading/></main>;
 if(auth.isError)return <main className="gate"><Brand/><h1>Вход в приложение</h1><Notice error={auth.error} retry={()=>void auth.refetch()}/><p className="muted">Если данные Telegram устарели, закройте мини-приложение и откройте его заново из бота.</p></main>;
 const user=auth.data;
 if(!user)return <main className="gate"><Brand/><div className="welcome-icon" aria-hidden="true">↗</div><p className="eyebrow">РАБОЧЕЕ ПРОСТРАНСТВО ОТРЯДА</p><h1>Хорошие смены<br/>начинаются с команды.</h1><p className="muted">Откройте мини-приложение из Telegram-бота отряда. Вход безопасный — без пароля и выбора чужого аккаунта.</p><div className="notice">Доступ через Telegram защищает анкеты и персональные данные участников.</div></main>;
 const setUser=(next:User)=>client.setQueryData(['session'],next);
 if(!user.isOnboarded || user.accountStatus==='REJECTED')return <main className="gate"><Brand/><Onboard user={user} saved={setUser}/><button className="text-button" disabled={logout.isPending} onClick={()=>logout.mutate()}>Выйти</button>{logout.isError&&<Notice error={logout.error}/>}</main>;
 if(user.accountStatus==='PENDING')return <main className="gate"><Brand/><p className="eyebrow">АНКЕТА ОТПРАВЛЕНА</p><h1>До встречи<br/>в команде.</h1><p className="muted">Руководитель проверит вашу анкету. Пока идёт проверка, данные смен и других участников недоступны.</p><StatusRefresh saved={setUser}/><button className="text-button" disabled={logout.isPending} onClick={()=>logout.mutate()}>Выйти</button>{logout.isError&&<Notice error={logout.error}/>}</main>;
 const title=selected?selected.title:creating?'Новая смена':{home:'Главная',shifts:'Смены',profile:'Профиль',team:'Проверка анкет'}[route];
 return <div className="shell"><header><Brand/><span className="role-pill">{roles[user.role]}</span></header><main>
  {(selected||creating)&&<button className="text-button" onClick={back}>← К списку смен</button>}
  <div className="page-heading"><div><p className="eyebrow">ОТРЯД «КОМАНДА»</p><h1>{title}</h1></div>{route==='shifts'&&!selected&&!creating&&user.role==='ADMIN'&&<button onClick={()=>setCreating(true)}>+ Создать</button>}</div>
  {selected?<ShiftDetail shift={selected}/>:creating?<CreateShift saved={shift=>{setCreating(false);setSelected(shift);void client.invalidateQueries({queryKey:['shifts']});}}/>:route==='home'?<>
   <section className="hero"><p>Рады видеть вас, {user.firstName}</p><h2>Одна команда.<br/>Много важных дел.</h2><p>Здесь начинается подготовка к вашей следующей смене.</p><button onClick={()=>setRoute('shifts')}>Перейти к сменам <span aria-hidden="true">↗</span></button></section>
   <div className="section-heading"><h2>Ближайшие смены</h2><button className="text-button" onClick={()=>setRoute('shifts')}>Все смены →</button></div><Shifts compact open={shift=>{setRoute('shifts');setSelected(shift);}}/>
   {user.role==='ADMIN'&&<button className="action-row" onClick={()=>setRoute('team')}><span><strong>Проверить новые анкеты</strong><small>Подтверждение участников отряда</small></span><span aria-hidden="true">→</span></button>}
   <p className="scope-note">Первый этап: вход, анкеты и смены. Отряды, программа, банк и опросы ещё не доступны в этой версии.</p>
  </>:route==='shifts'?<Shifts open={setSelected}/>:route==='team'&&user.role==='ADMIN'?<Team/>:<section className="panel"><div className="avatar" aria-hidden="true">{user.firstName.slice(0,1)}</div><h2>{fullName(user)}</h2><p className="muted">{roles[user.role]} · Анкета подтверждена</p><dl><dt>Дата рождения</dt><dd>{user.birthDate?dateLabel(user.birthDate):'Не указана'}</dd><dt>Телефон</dt><dd>{user.phone||'Не указан'}</dd><dt>Указанный стаж</dt><dd>{user.manualExperience||'Не указан'}</dd><dt>Регистрация</dt><dd>{dateLabel(user.createdAt)}</dd></dl><button className="secondary" disabled={logout.isPending} onClick={()=>logout.mutate()}>{logout.isPending?'Выходим…':'Выйти из аккаунта'}</button>{logout.isError&&<Notice error={logout.error}/>}</section>}
 </main><nav className="tabbar" aria-label="Основная навигация">{([{key:'home',label:'Главная',icon:'⌂'},{key:'shifts',label:'Смены',icon:'▦'},...(user.role==='ADMIN'?[{key:'team' as const,label:'Анкеты',icon:'☷'}]:[]),{key:'profile',label:'Профиль',icon:'○'}] as const).map(tab=><button key={tab.key} aria-current={route===tab.key?'page':undefined} onClick={()=>{back();setRoute(tab.key);window.scrollTo(0,0);}}><span aria-hidden="true">{tab.icon}</span>{tab.label}</button>)}</nav></div>;
}
function StatusRefresh({saved}:{saved:(user:User)=>void}){
 const refresh=useMutation({mutationFn:()=>api<{user:User}>('/auth/me'),onSuccess:data=>saved(data.user)});
 return <><button disabled={refresh.isPending} onClick={()=>refresh.mutate()}>{refresh.isPending?'Проверяем…':'Проверить статус'}</button>{refresh.isSuccess&&<p role="status">Статус обновлён.</p>}{refresh.isError&&<Notice error={refresh.error}/>}</>;
}
function Onboard({user,saved}:{user:User;saved:(user:User)=>void}){
 const [step,setStep]=useState(1);const trainee=user.role==='TRAINEE';
 const [form,setForm]=useState({firstName:user.firstName,lastName:user.lastName??'',middleName:user.middleName??'',birthDate:user.birthDate?.slice(0,10)??'',phone:user.phone??'',manualShiftsCount:user.manualShiftsCount,manualExperience:user.manualExperience??'',creativeTaskUrl:user.creativeTaskUrl??'',presentationUrl:user.presentationUrl??'',confirmed:false});
 const set=<K extends keyof typeof form>(key:K,value:typeof form[K])=>setForm(f=>({...f,[key]:value}));
 const mutation=useMutation({mutationFn:()=>api<{user:User}>('/auth/onboard',{...form,creativeTaskUrl:trainee?form.creativeTaskUrl:undefined,presentationUrl:trainee?form.presentationUrl:undefined}),onSuccess:data=>saved(data.user)});
 const submit=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();if(step===1)setStep(2);else mutation.mutate();};
 return <><p className="eyebrow">ШАГ {step} ИЗ 2 · ВАША АНКЕТА</p><h1>{step===1?'Давайте познакомимся.':'Расскажите о себе.'}</h1>{user.accountStatus==='REJECTED'&&<div role="status" className="notice">Анкета отклонена. Исправьте данные и отправьте её на проверку повторно. Повышение роли через анкету недоступно.</div>}<p className="muted">Ваша роль: {roles[user.role]}. Роли назначает руководитель.</p>
 <form onSubmit={submit} className="panel">{step===1?<>
  <Field label="Фамилия *"><input autoComplete="family-name" required maxLength={100} value={form.lastName} onChange={e=>set('lastName',e.target.value)}/></Field>
  <Field label="Имя *"><input autoComplete="given-name" required maxLength={100} value={form.firstName} onChange={e=>set('firstName',e.target.value)}/></Field>
  <Field label="Отчество"><input autoComplete="additional-name" maxLength={100} value={form.middleName} onChange={e=>set('middleName',e.target.value)}/></Field>
  <Field label="Дата рождения *" hint="Регистрация с 14 лет"><input type="date" autoComplete="bday" required value={form.birthDate} onChange={e=>set('birthDate',e.target.value)}/></Field>
  <Field label="Телефон"><input type="tel" autoComplete="tel" maxLength={30} value={form.phone} onChange={e=>set('phone',e.target.value)}/></Field>
 </>:<>
  <Field label="Количество отработанных смен"><input type="number" min={0} max={1000} required value={form.manualShiftsCount} onChange={e=>set('manualShiftsCount',Number(e.target.value))}/></Field>
  <Field label="Стаж" hint="Например, 2 года 3 месяца. Пока указывается вручную."><input maxLength={200} value={form.manualExperience} onChange={e=>set('manualExperience',e.target.value)}/></Field>
  {trainee&&<><Field label="Ссылка на творческое задание *"><input type="url" required maxLength={2048} value={form.creativeTaskUrl} onChange={e=>set('creativeTaskUrl',e.target.value)}/></Field><Field label="Ссылка на презентацию *"><input type="url" required maxLength={2048} value={form.presentationUrl} onChange={e=>set('presentationUrl',e.target.value)}/></Field><label className="checkbox"><input type="checkbox" required checked={form.confirmed} onChange={e=>set('confirmed',e.target.checked)}/>Я подтверждаю достоверность данных</label></>}
 </>}{mutation.isError&&<Notice error={mutation.error}/>}<div className="form-actions">{step===2&&<button type="button" className="secondary" disabled={mutation.isPending} onClick={()=>setStep(1)}>Назад</button>}<button disabled={mutation.isPending}>{mutation.isPending?'Сохраняем…':step===1?'Продолжить →':trainee?'Отправить на проверку':'Завершить регистрацию'}</button></div></form></>;
}
function ShiftCard({shift,open}:{shift:Shift;open:()=>void}){return <button className="shift-card" onClick={open}><span className="date-block"><b>{new Date(shift.startDate).getUTCDate()}</b><span>{new Date(shift.startDate).toLocaleDateString('ru-RU',{month:'short',timeZone:'UTC'})}</span></span><span className="shift-summary"><small>{dateLabel(shift.startDate)} — {dateLabel(shift.endDate)}</small><strong>{shift.title}</strong><span className="status">{stages[shift.stage]}</span></span><span aria-hidden="true">↗</span></button>;}
function Shifts({open,compact=false}:{open:(shift:Shift)=>void;compact?:boolean}){
 const [page,setPage]=useState(1);
 const query=useQuery({queryKey:['shifts',page,compact],queryFn:()=>api<Page<Shift>>(`/shifts?page=${page}&pageSize=${compact?3:20}${compact?'&upcoming=true':''}`)});
 if(query.isPending)return <Loading/>;if(query.isError)return <Notice error={query.error} retry={()=>void query.refetch()}/>;
 const list=compact?query.data.items.filter(shift=>shift.endDate.slice(0,10)>=new Date().toISOString().slice(0,10)):query.data.items;
 return <>{list.length?<div className="shift-list">{list.map(shift=><ShiftCard key={shift.id} shift={shift} open={()=>open(shift)}/>)}</div>:<div className="empty"><span aria-hidden="true">▦</span><h2>{compact?'Ближайших смен пока нет':'Доступных смен пока нет'}</h2><p>Когда руководитель откроет смену для вашей роли, она появится здесь.</p></div>}{!compact&&<div className="pagination"><button className="secondary" disabled={page===1} onClick={()=>setPage(page-1)}>Назад</button><span>Страница {page}</span><button className="secondary" disabled={page*20>=query.data.total} onClick={()=>setPage(page+1)}>Далее</button></div>}</>;
}
function ShiftDetail({shift}:{shift:Shift}){
 const query=useQuery({queryKey:['shift',shift.id],queryFn:()=>api<{shift:Shift}>('/shifts/'+shift.id)});
 if(query.isPending)return <Loading/>;if(query.isError)return <Notice error={query.error} retry={()=>void query.refetch()}/>;
 const item=query.data.shift;return <section className="panel"><span className="status">{stages[item.stage]}</span><h2>{item.title}</h2><p className="muted">{dateLabel(item.startDate)} — {dateLabel(item.endDate)}</p>{item.description&&<p className="multiline">{item.description}</p>}<dl><dt>Видимость</dt><dd>{visibility[item.visibility]}</dd><dt>Набор ведущих</dt><dd>{item.leadRecruitOpen?'Открыт':'Закрыт'}</dd><dt>Набор стажёров</dt><dd>{item.traineeRecruitOpen?'Открыт':'Закрыт'}</dd></dl><p className="scope-note">Подача заявок, управление этапами, отрядами и программой будут доступны в следующих этапах реализации.</p></section>;
}
function CreateShift({saved}:{saved:(shift:Shift)=>void}){
 const mutation=useMutation({mutationFn:(body:unknown)=>api<{shift:Shift}>('/shifts',body),onSuccess:data=>saved(data.shift)});
 return <form className="panel" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);mutation.mutate(Object.fromEntries(f));}}><Field label="Название *"><input name="title" required maxLength={160}/></Field><Field label="Описание"><textarea name="description" maxLength={5000} rows={4}/></Field><div className="two-columns"><Field label="Начало *"><input name="startDate" type="date" required/></Field><Field label="Окончание *"><input name="endDate" type="date" required/></Field></div><Field label="Кому доступна смена"><select name="visibility" defaultValue="ADMIN_ONLY">{Object.entries(visibility).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field><div className="notice">По умолчанию смена — закрытый черновик, видимый только руководителю.</div>{mutation.isError&&<Notice error={mutation.error}/>}<button disabled={mutation.isPending}>{mutation.isPending?'Создаём…':'Создать смену'}</button></form>;
}
function Team(){
 const client=useQueryClient();const [page,setPage]=useState(1);const [decision,setDecision]=useState<{user:User;action:'confirm'|'reject'}|null>(null);
 const query=useQuery({queryKey:['pending',page],queryFn:()=>api<Page<User>>(`/users/pending?page=${page}&pageSize=20`)});
 const mutation=useMutation({mutationFn:({user,action}:{user:User;action:'confirm'|'reject'})=>api('/users/'+user.id+'/'+action,{}),onSuccess:()=>{setDecision(null);void client.invalidateQueries({queryKey:['pending']});}});
 if(query.isPending)return <Loading/>;if(query.isError)return <Notice error={query.error} retry={()=>void query.refetch()}/>;
 return <>{mutation.isSuccess&&<p className="notice" role="status">Решение сохранено.</p>}{mutation.isError&&<Notice error={mutation.error}/>}<p className="muted">Новые участники ждут решения руководителя. Ссылки открываются во внешнем браузере.</p>{query.data.items.length===0?<div className="empty"><h2>Все анкеты проверены</h2><p>Новые анкеты появятся здесь после заполнения.</p></div>:query.data.items.map(user=><section className="panel" key={user.id}><span className="status">Ожидает проверки</span><h2>{fullName(user)}</h2><p className="muted">{user.birthDate?dateLabel(user.birthDate):'Дата рождения не указана'} · {roles[user.role]}</p><div className="links">{user.creativeTaskUrl&&<a href={user.creativeTaskUrl} target="_blank" rel="noopener noreferrer">Творческое задание ↗</a>}{user.presentationUrl&&<a href={user.presentationUrl} target="_blank" rel="noopener noreferrer">Презентация ↗</a>}</div>{decision?.user.id===user.id?<div className="notice"><p>{decision.action==='confirm'?'Подтвердить':'Отклонить'} анкету {fullName(user)}?</p><div className="form-actions"><button disabled={mutation.isPending} onClick={()=>mutation.mutate(decision)}>{mutation.isPending?'Сохраняем…':'Подтвердить решение'}</button><button className="secondary" disabled={mutation.isPending} onClick={()=>setDecision(null)}>Отмена</button></div></div>:<div className="form-actions"><button disabled={mutation.isPending} onClick={()=>setDecision({user,action:'confirm'})}>Принять</button><button className="secondary danger" disabled={mutation.isPending} onClick={()=>setDecision({user,action:'reject'})}>Отклонить</button></div>}</section>)}<div className="pagination"><button className="secondary" disabled={page===1} onClick={()=>setPage(page-1)}>Назад</button><span>Страница {page}</span><button className="secondary" disabled={page*20>=query.data.total} onClick={()=>setPage(page+1)}>Далее</button></div></>;
}
