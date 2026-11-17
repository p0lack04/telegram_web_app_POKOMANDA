import {useState,type FormEvent} from 'react';
import {useMutation,useQueryClient,type QueryClient} from '@tanstack/react-query';
import {api,ApiError} from './api';
import type {Squad} from './types';

export function squadError(error:unknown):string {
 if(error instanceof ApiError){
  if(error.status===403)return 'Нет права на это действие. '+error.message;
  if(error.status===404)return 'Запись или отряд больше недоступны.';
  return error.message;
 }
 return 'Не удалось выполнить запрос. Повторите попытку.';
}

export async function refreshSquads(client:QueryClient,shiftId:string) {
 await Promise.all(['squads','staff','children','staffing','roles','history','squad-history','squad-candidates','member-status','daily-marks'].map(key=>client.invalidateQueries({queryKey:[key,shiftId]})));
}
export function SquadForm({squad,pending,error,save,cancel}:{squad?:Squad;pending:boolean;error:unknown;save:(data:{name:string;color:string|null;sortOrder:number})=>void;cancel:()=>void}) {
 const submit=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const data=new FormData(event.currentTarget);save({name:String(data.get('name')).trim(),color:String(data.get('color')).trim()||null,sortOrder:Number(data.get('sortOrder'))});};
 return <form className="panel" onSubmit={submit}><h3>{squad?'Редактирование отряда':'Новый отряд'}</h3><fieldset disabled={pending}>
  <label className="field"><span>Название отряда *</span><input name="name" required maxLength={120} defaultValue={squad?.name??''}/></label>
  <label className="field"><span>Цвет отряда</span><input name="color" placeholder="#28634a" pattern="#[0-9a-fA-F]{6}" maxLength={7} defaultValue={squad?.color??'#28634a'}/><small>Шесть шестнадцатеричных цифр после #; пустое значение задаёт стандартный цвет #28634a.</small></label>
  <label className="field"><span>Порядок отряда</span><input name="sortOrder" type="number" required min={-100000} max={100000} defaultValue={squad?.sortOrder??0}/></label>
  <div className="form-actions"><button>{pending?'Сохраняем…':squad?'Сохранить отряд':'Создать отряд'}</button><button type="button" className="secondary" onClick={cancel}>Отмена</button></div>
 </fieldset>{error!=null&&<p className="notice error" role="alert">{squadError(error)}</p>}</form>;
}
export function CreateSquad({shiftId}:{shiftId:string}) {
 const client=useQueryClient();const [open,setOpen]=useState(false);const [saved,setSaved]=useState(false);
 const mutation=useMutation({mutationFn:(body:object)=>api(`/shifts/${shiftId}/squads`,body),onSuccess:async()=>{setOpen(false);setSaved(true);await refreshSquads(client,shiftId);}});
 return <>{saved&&<p className="notice" role="status">Отряд создан.</p>}{open?<SquadForm pending={mutation.isPending} error={mutation.error} save={data=>mutation.mutate(data)} cancel={()=>setOpen(false)}/>:<button onClick={()=>{setOpen(true);setSaved(false);mutation.reset();}}>Создать отряд</button>}</>;
}
export function ManageSquad({shiftId,squad,deleted}:{shiftId:string;squad:Squad;deleted:()=>void}) {
 const client=useQueryClient();const [editing,setEditing]=useState(false);const [removing,setRemoving]=useState(false);
 const update=useMutation({mutationFn:(body:object)=>api(`/shifts/${shiftId}/squads/${squad.id}`,body,'PATCH'),onSuccess:async()=>{setEditing(false);await refreshSquads(client,shiftId);}});
 const remove=useMutation({mutationFn:()=>api(`/shifts/${shiftId}/squads/${squad.id}`,{},'DELETE'),onSuccess:async()=>{await refreshSquads(client,shiftId);deleted();}});
 return <>{update.isSuccess&&<p role="status">Отряд сохранён.</p>}{editing?<SquadForm squad={squad} pending={update.isPending} error={update.error} save={data=>update.mutate(data)} cancel={()=>setEditing(false)}/>:<button className="secondary" disabled={remove.isPending} onClick={()=>{setEditing(true);update.reset();}}>Редактировать отряд</button>}
 {removing?<div className="notice"><p>Удалить пустой отряд «{squad.name}»? Если есть участники, должности или другие связанные данные, сервер запретит удаление.</p><div className="form-actions"><button className="danger" disabled={remove.isPending} onClick={()=>remove.mutate()}>{remove.isPending?'Удаляем…':'Подтвердить удаление отряда'}</button><button className="secondary" disabled={remove.isPending} onClick={()=>setRemoving(false)}>Отмена</button></div></div>:<button className="secondary danger" disabled={editing} onClick={()=>{setRemoving(true);remove.reset();}}>Удалить пустой отряд</button>}
 {remove.isError&&<p className="notice error" role="alert">{squadError(remove.error)}</p>}</>;
}
