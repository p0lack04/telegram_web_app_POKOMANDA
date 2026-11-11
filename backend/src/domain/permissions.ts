import type { User, Shift, Prisma } from '@prisma/client';
import { requireRule } from '../errors.js';

export const ROLE_PERMISSIONS = {
 'Руководитель':['shift.edit','shift.manage_roles','program.view','program.edit','surveys.create','surveys.view_results','squad.manage','squad.view_all','participants.import','participants.edit_payment','participants.edit_checkin','participants.edit_room','tech_requests.manage','tech_requests.assign','bank.upload_files','bank.edit_all'],
 'Заместитель руководителя':['shift.edit','shift.manage_roles','program.view','program.edit','surveys.create','surveys.view_results','squad.manage','squad.view_all','participants.import','participants.edit_payment','participants.edit_checkin','participants.edit_room','tech_requests.manage','bank.upload_files'],
 'Ответственный за программу':['program.view','program.edit','surveys.view_results','squad.view_all','tech_requests.manage'],
 'Ответственный за досуг':['program.view','program.edit_entertainment','bank.upload_files','tech_requests.manage'],
 'Ответственный за расселение':['participants.edit_room','squad.view_all','participants.import'],
 'Ответственный за столовую':['squad.view_all','participants.import'],
 'Ответственный за хозчасть':['squad.view_all'],
 'Медиа-группа':['bank.upload_files'],
 'Техническая поддержка':['tech_requests.manage'],
 'Руководитель тех группы':['tech_requests.assign','tech_requests.manage'],
 'Хореограф':['program.view','bank.upload_files'],
 'Ведущий отряда':['squad.view_own','squad.manage','program.view','tech_requests.manage'],
 'Стажёр':['squad.view_own'],
} as const;
export type Position = keyof typeof ROLE_PERMISSIONS;
export type Permission = (typeof ROLE_PERMISSIONS)[Position][number];
export const active = (user:Pick<User,'isOnboarded'|'accountStatus'>) => user.isOnboarded && user.accountStatus === 'CONFIRMED';
export function requireActive(user:User) { requireRule(active(user),403,'ACCOUNT_NOT_READY','Заполните анкету и дождитесь подтверждения аккаунта'); }
export function requireAdmin(user:User) { requireActive(user); requireRule(user.role==='ADMIN',403,'FORBIDDEN','Действие доступно только руководителю'); }
export function visibleShiftWhere(user:Pick<User,'role'>):Prisma.ShiftWhereInput {
 if(user.role==='ADMIN') return {};
 return {visibility:{in:user.role==='LEAD'?['ADMIN_LEAD','ADMIN_LEAD_TRAINEE']:['ADMIN_LEAD_TRAINEE']}};
}
export function canSeeShift(user:Pick<User,'role'>,shift:Pick<Shift,'visibility'>):boolean {
 return user.role==='ADMIN' || shift.visibility==='ADMIN_LEAD_TRAINEE' || (user.role==='LEAD' && shift.visibility==='ADMIN_LEAD');
}
export function permissions(user:User,shift:Shift,positions:readonly string[]):Set<Permission> {
 if(!active(user) || !canSeeShift(user,shift)) return new Set();
 if(user.role==='ADMIN') return new Set(Object.values(ROLE_PERMISSIONS).flat());
 const values:Permission[]=[];
 for(const position of positions) if(Object.hasOwn(ROLE_PERMISSIONS,position)) values.push(...ROLE_PERMISSIONS[position as Position]);
 return new Set(values);
}
