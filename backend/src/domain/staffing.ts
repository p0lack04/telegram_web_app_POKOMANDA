import type { Role, ApplicationType } from '@prisma/client';
import { requireRule } from '../errors.js';
import { ROLE_PERMISSIONS } from './permissions.js';

export const staffingActions = ['APPLICATION_SUBMIT','APPLICATION_APPROVED','APPLICATION_REJECTED','STAFF_ADDED','POSITION_ASSIGNED','POSITION_REMOVED','RECRUITMENT_UPDATED'] as const;
export function applicationTypeFor(role:Role):ApplicationType {
 requireRule(role==='LEAD'||role==='TRAINEE',400,'INVALID_APPLICANT','Заявки подают ведущие и стажёры');
 return role==='LEAD'?'LEAD_RECRUIT':'TRAINEE_RECRUIT';
}
export function requireKnownPosition(position:string,actorRole:Role) {
 requireRule(Object.hasOwn(ROLE_PERMISSIONS,position),400,'UNKNOWN_POSITION','Неизвестная должность');
 requireRule(position!=='Руководитель'||actorRole==='ADMIN',403,'FORBIDDEN','Назначение руководителя доступно только ADMIN');
}
