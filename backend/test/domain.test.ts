import { describe,it,expect } from 'vitest';
import { dateOnly,onboardingSchema,shiftSchema,pagination } from '../src/domain/schemas.js';
import { canSeeShift,permissions,active,ROLE_PERMISSIONS } from '../src/domain/permissions.js';
import type { User,Shift } from '@prisma/client';

const user={id:'u',role:'TRAINEE',isOnboarded:true,accountStatus:'CONFIRMED'} as User;
const shift={visibility:'ADMIN_LEAD_TRAINEE'} as Shift;
describe('domain boundary',()=>{
 it.each(['2026-02-29','2026-02-31','bad','2026-13-01'])('invalid date %s',value=>expect(dateOnly.safeParse(value).success).toBe(false));
 it('принимает високосную дату',()=>expect(dateOnly.parse('2024-02-29')).toBe('2024-02-29'));
 it('не принимает роль из анкеты',()=>expect(onboardingSchema.safeParse({firstName:'Имя',lastName:'Фамилия',birthDate:'2000-01-01',confirmed:true,role:'ADMIN'}).success).toBe(false));
 it('отклоняет обратный интервал смены',()=>expect(shiftSchema.safeParse({title:'Смена',startDate:'2026-02-02',endDate:'2026-01-01'}).success).toBe(false));
 it('ограничивает страницу',()=>expect(pagination.safeParse({pageSize:10000}).success).toBe(false));
 it('не выдаёт права отклонённому аккаунту',()=>expect(permissions({...user,role:'ADMIN',accountStatus:'REJECTED'},shift,[]).size).toBe(0));
 it('отделяет onboarding от подтверждения',()=>expect(active({...user,isOnboarded:false})).toBe(false));
 it('не выдаёт права в скрытой смене',()=>expect(permissions(user,{...shift,visibility:'ADMIN_ONLY'},['Заместитель руководителя']).size).toBe(0));
 it('не доверяет неизвестной должности и prototype keys',()=>expect(permissions(user,shift,['toString','__proto__','ADMIN']).size).toBe(0));
 it('объединяет права нескольких должностей',()=>{const p=permissions(user,shift,['Медиа-группа','Ответственный за расселение']);expect(p.has('bank.upload_files')).toBe(true);expect(p.has('participants.edit_room')).toBe(true);expect(p.has('participants.edit_payment')).toBe(false);});
 it.each(['ADMIN','LEAD','TRAINEE'] as const)('visibility %s',role=>{expect(canSeeShift({role},{visibility:'ADMIN_ONLY'})).toBe(role==='ADMIN');expect(canSeeShift({role},{visibility:'ADMIN_LEAD'})).toBe(role!=='TRAINEE');expect(canSeeShift({role},shift)).toBe(true);});
 it.each(Object.keys(ROLE_PERMISSIONS))('каталог должности %s выдаёт только её права',position=>expect([...permissions(user,shift,[position])].sort()).toEqual([...ROLE_PERMISSIONS[position as keyof typeof ROLE_PERMISSIONS]].sort()));
});
