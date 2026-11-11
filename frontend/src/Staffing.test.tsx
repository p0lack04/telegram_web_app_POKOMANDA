import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import Staffing,{OwnStaffing,allowedPositions,recruitmentFor} from './Staffing';
import {type Shift,type UserSummary,type StaffingInfo,type Application,type Page} from './types';

const shift:Shift={id:'s',title:'Летняя смена',description:null,startDate:'2026-06-01',endDate:'2026-06-20',stage:'STAGE_4',visibility:'ADMIN_LEAD_TRAINEE',leadRecruitOpen:true,traineeRecruitOpen:false};
const person:UserSummary={id:'u',firstName:'Анна',lastName:'Иванова',middleName:null,role:'LEAD'};
const info:StaffingInfo={canReview:false,canManageRoles:false,positions:['Руководитель','Ведущий'],squads:[{id:'q',name:'Первый отряд'}]};
const emptyPage={items:[],total:0,page:1,pageSize:20};
function setup(overrides:Partial<StaffingInfo>={}) {
 const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});
 client.setQueryData(['staffing','s'],{...info,...overrides});
 for(const key of ['applications','staff','roles','history'])client.setQueryData([key,'s',1],emptyPage);
 return client;
}
function render(client:QueryClient,user=person) {return renderToStaticMarkup(<QueryClientProvider client={client}><Staffing shift={shift} user={user}/></QueryClientProvider>);}

describe('Правила набора в UI',()=>{
 it('открытый набор ведущих не зависит от этапа смены',()=>expect(recruitmentFor(shift,'LEAD')).toEqual({type:'LEAD_RECRUIT',open:true}));
 it('флаг стажёров проверяется отдельно',()=>expect(recruitmentFor(shift,'TRAINEE')).toEqual({type:'TRAINEE_RECRUIT',open:false}));
 it('ADMIN не подаёт заявку на себя',()=>expect(recruitmentFor(shift,'ADMIN')).toBeNull());
 it('каталог должностей приходит с сервера, Руководитель доступен только ADMIN',()=>{expect(allowedPositions(info.positions,'LEAD')).toEqual(['Ведущий']);expect(allowedPositions(info.positions,'TRAINEE')).toEqual(['Ведущий']);expect(allowedPositions(info.positions,'ADMIN')).toEqual(info.positions);});
});
describe('Представление набора и профиля',()=>{
 it('показывает подачу на позднем этапе, но скрывает управление без флагов',()=>{const html=render(setup());expect(html).toContain('Подать заявку');expect(html).toContain('Проведение смены');expect(html).not.toContain('Сохранить параметры');expect(html).not.toContain('Назначить должность');expect(html).not.toContain('Добавить участника вручную');});
 it('роль ADMIN сама по себе не подменяет флаги сервера',()=>{const html=render(setup(),{...person,role:'ADMIN'});expect(html).not.toContain('Сохранить параметры');expect(html).not.toContain('Добавить участника вручную');});
 it('закрытый набор отключает подачу заявки',()=>{const html=render(setup(),{...person,role:'TRAINEE'});expect(html).toContain('набор');expect(html).toMatch(/<button disabled="">Подать заявку/);});
 it('показывает собственный статус вместо повторной подачи',()=>{const client=setup();const application:Application={id:'a',shiftId:'s',userId:'u',type:'LEAD_RECRUIT',status:'PENDING',version:2,createdAt:'2026-04-01',updatedAt:'2026-04-01',user:person,shift};client.setQueryData(['applications','s',1],{...emptyPage,items:[application],total:1} satisfies Page<Application>);const html=render(client);expect(html).toContain('На рассмотрении');expect(html).not.toContain('Подать заявку');expect(html).not.toContain('Одобрить');});
 it('показывает ADMIN управление и поиск только с серверными правами',()=>{const html=render(setup({canReview:true,canManageRoles:true}),{...person,role:'ADMIN'});expect(html).toContain('Сохранить параметры');expect(html).toContain('Добавить участника вручную');expect(html).not.toContain('Подать заявку');});
 it('у не-ADMIN нельзя снять Руководителя, но можно другие должности',()=>{const client=setup({canManageRoles:true});client.setQueryData(['roles','s',1],{...emptyPage,items:[{id:'r',userId:'u',shiftId:'s',position:'Руководитель',squadId:null,createdAt:'2026-04-01',user:person}],total:1});expect(render(client)).not.toContain('Снять должность');client.setQueryData(['roles','s',1],{...emptyPage,items:[{id:'r',userId:'u',shiftId:'s',position:'Ведущий',squadId:'q',createdAt:'2026-04-01',user:person}],total:1});const html=render(client);expect(html).toContain('Снять должность');expect(html).toContain('Первый отряд');});
 it('ADMIN принимает решение только по PENDING, закрытые не пересматриваются',()=>{const client=setup({canReview:true});const application:Application={id:'a',shiftId:'s',userId:'u',type:'LEAD_RECRUIT',status:'APPROVED',version:2,createdAt:'2026-04-01',updatedAt:'2026-04-01',user:person,shift};client.setQueryData(['applications','s',1],{...emptyPage,items:[application],total:1});const admin={...person,role:'ADMIN' as const};expect(render(client,admin)).not.toContain('>Отклонить<');expect(render(client,admin)).not.toContain('>Одобрить<');client.setQueryData(['applications','s',1],{...emptyPage,items:[{...application,status:'PENDING'}],total:1});expect(render(client,admin)).toContain('>Одобрить<');expect(render(client,admin)).toContain('>Отклонить<');});
 it('педсостав не запрашивается и не показывается без права менеджера',()=>{const html=render(setup());expect(html).not.toContain('Педсостав смены');expect(html).toContain('Мои должности на смене');});
 it('педсостав и должности имеют независимую пагинацию',()=>{const client=setup({canManageRoles:true});client.setQueryData(['staff','s',1],{...emptyPage,total:42});client.setQueryData(['roles','s',1],{...emptyPage,total:24});expect(render(client).match(/Страница 1/g)).toHaveLength(2);});
 it('история показывает участника и русские подписи переходов',()=>{const client=setup();client.setQueryData(['history','s',1],{...emptyPage,total:1,items:[{id:'h',action:'APPLICATION_APPROVED',entityType:'Application',entityId:'a',createdAt:'2026-04-01',actor:person,subject:person,details:{subjectUserId:'u',from:'PENDING',to:'APPROVED'}}]});const html=render(client);expect(html).toContain('Заявка одобрена');expect(html).toContain('Участник: Иванова Анна');expect(html).toContain('До: На рассмотрении');expect(html).toContain('После: Одобрена');});
 it('профиль содержит свои списки и in-app уведомления с безопасным текстом',()=>{const client=setup();client.setQueryData(['own','applications',1],emptyPage);client.setQueryData(['own','assignments',1],emptyPage);client.setQueryData(['notifications',1],{...emptyPage,total:1,items:[{id:'n',kind:'APPLICATION',text:'<script>опасно</script>',readAt:null,createdAt:'2026-04-01'}]});const html=renderToStaticMarkup(<QueryClientProvider client={client}><OwnStaffing/></QueryClientProvider>);expect(html).toContain('Мои заявки');expect(html).toContain('Мои назначения');expect(html).toContain('Отметить прочитанным');expect(html).toContain('&lt;script&gt;');expect(html).not.toContain('<script>');expect(html).toContain('Это не подтверждение доставки через Telegram');});
});
