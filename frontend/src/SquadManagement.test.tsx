import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import type {ReactNode} from 'react';
import {Squads,SquadDetail,squadKeys} from './Squads';
import {SquadStaff} from './SquadStaff';
import {DailyMarks,MemberStatusPanel,StatusEditor,type MemberStatusData} from './MemberStatus';
import {refreshSquads,squadError} from './SquadManagement';
import {ApiError} from './api';

const makeClient=()=>new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});
const render=(client:QueryClient,child:ReactNode)=>renderToStaticMarkup(<QueryClientProvider client={client}>{child}</QueryClientProvider>);
const squad={id:'q',name:'Первый',color:'#123abc',sortOrder:1};
const page={items:[],total:0,page:1,pageSize:20};
const member={id:'m',paymentStatus:'PARTIAL' as const,paymentNote:'Ожидается подтверждение',checkinStatus:false,updatedAt:'2026-11-16T00:00:00.000Z'};
describe('Завершение отрядов и состава: серверные capabilities',()=>{
 it.each([true,false])('создание доступно только по флагу create=%s',create=>{
  const client=makeClient();client.setQueryData(squadKeys.list('s',1),{...page,capabilities:{create}});
  expect(render(client,<Squads shiftId="s" open={()=>{}}/>).includes('Создать отряд')).toBe(create);
 });
 it.each([true,false])('редактирование и удаление доступны только по флагу manage=%s',manage=>{
  const client=makeClient();client.setQueryData(squadKeys.detail('s','q'),{squad,capabilities:{manage}});
  const html=render(client,<SquadDetail shiftId="s" squadId="q"/>);
  expect(html.includes('Редактировать отряд')).toBe(manage);expect(html.includes('Удалить пустой отряд')).toBe(manage);expect(html).not.toContain('Подтвердить удаление отряда');
 });
 it.each([true,false])('состав показывает несколько членств и связанные должности; manage=%s',manage=>{
  const client=makeClient();client.setQueryData(['staff','s','q',1],{...page,total:1,capabilities:{manage},items:[{id:'m',userId:'u',firstName:'Анна',lastName:'Иванова',middleName:null,memberType:'LEAD',memberships:[{squadId:'q',name:'Первый'},{squadId:'q2',name:'Второй'}],positions:[{id:'r',position:'Ведущий отряда',squadId:'q'}]}]});
  client.setQueryData(['squad-history','s','q',1],{...page,items:[{id:'a',action:'STAFF_MEMBER_ADDED',createdAt:'2026-11-16T00:00:00.000Z'}]});
  const html=render(client,<SquadStaff shiftId="s" squadId="q"/>);
  expect(html).toContain('Первый, Второй');expect(html).toContain('связан с этим отрядом');expect(html).toContain('Сотрудник добавлен в отряд');
  for(const label of ['Добавить сотрудника в отряд','Перевести в другой отряд','Снять членство'])expect(html.includes(label)).toBe(manage);
  expect(html).not.toContain('Подтвердить снятие членства');
 });
 it('инвалидация распространяется на все списки, карточки, назначения и поля, но не другую смену',async()=>{
  const client=makeClient();const keys=[['squads','s','list',1],['staff','s','q',1],['children','s','q',1],['staffing','s'],['roles','s',1],['history','s',1],['squad-history','s','q',1],['squad-candidates','s','q','',1],['member-status','s','m'],['daily-marks','s','m']];
  for(const key of keys)client.setQueryData(key,{});client.setQueryData(['squads','other','list',1],{});
  await refreshSquads(client,'s');for(const key of keys)expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  expect(client.getQueryState(['squads','other','list',1])?.isInvalidated).toBe(false);
 });
 it('конфликты состава и CAS сохраняют серверную причину, без текста об импорте',()=>{
  expect(squadError(new ApiError(409,'ROLE_SQUAD_MEMBERSHIP_CONFLICT','Сначала отвяжите должность'))).toBe('Сначала отвяжите должность');
  expect(squadError(new ApiError(409,'STALE_VERSION','Запись изменена'))).toBe('Запись изменена');
 });
});
describe('Оплата, заезд и календарные отметки',()=>{
 it.each([[false,false],[true,false],[false,true],[true,true]])('полевые формы зависят от отдельных capabilities %s/%s',(editPayment,editCheckin)=>{
  const data:MemberStatusData={member,capabilities:{editPayment,editCheckin}};
  const html=render(makeClient(),<StatusEditor shiftId="s" data={data} reload={()=>{}}/>);
  expect(html).toContain('Частично оплачено');expect(html).toContain('Ожидается подтверждение');
  expect(html.includes('Сохранить оплату')).toBe(editPayment);expect(html.includes('Сохранить заезд')).toBe(editCheckin);
  if(editPayment){expect(html).toContain('value="UNPAID"');expect(html).toContain('value="PARTIAL"');expect(html).toContain('value="PAID"');expect(html).toMatch(/<textarea required=""/);}
 });
 it('пустое примечание PARTIAL блокирует сохранение в UI',()=>{
  const html=render(makeClient(),<StatusEditor shiftId="s" data={{member:{...member,paymentNote:'   '},capabilities:{editPayment:true,editCheckin:false}}} reload={()=>{}}/>);
  expect(html).toContain('<button disabled="">Сохранить оплату');
 });
 it.each([false,true])('date-only отображается без timezone браузера, явный выбор по edit=%s',edit=>{
  const client=makeClient();client.setQueryData(['daily-marks','s','m','list',1],{items:[{id:'d',date:'2028-02-29',markType:'TECHNIC',note:'Синтетическая отметка',updatedAt:member.updatedAt}],timeZone:'Europe/Moscow',today:'2028-03-01',capabilities:{edit}});
  const html=render(client,<DailyMarks shiftId="s" memberId="m"/>);
  expect(html).toContain('2028-02-29');expect(html).toContain('Europe/Moscow');expect(html).toContain('Техник');expect(html.includes('Дата отметки')).toBe(edit);expect(html.includes('Сегодня по времени смены')).toBe(edit);
  if(edit)expect(html).toContain('type="date" value=""');expect(html).not.toContain('Удалить отметку');
 });
 it('ошибка перечитывания статуса скрывает старые поля и предлагает retry',async()=>{
  const client=makeClient();const key=['member-status','s','m'];client.setQueryData(key,{member,capabilities:{editPayment:true,editCheckin:true}});
  await client.fetchQuery({queryKey:key,staleTime:0,queryFn:()=>Promise.reject(new ApiError(403,'FORBIDDEN','Доступ закрыт'))}).catch(()=>{});
  const html=render(client,<MemberStatusPanel shiftId="s" memberId="m"/>);expect(html).toContain('Повторить загрузку статуса');expect(html).not.toContain('Ожидается подтверждение');expect(html).not.toContain('Сохранить оплату');
 });
});
