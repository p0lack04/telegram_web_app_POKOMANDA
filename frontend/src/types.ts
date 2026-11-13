export interface UserSummary {
 id:string;firstName:string;lastName:string|null;middleName:string|null;role:'ADMIN'|'LEAD'|'TRAINEE';
}
export interface Application {
 id:string;shiftId:string;userId:string;type:'LEAD_RECRUIT'|'TRAINEE_RECRUIT';status:'PENDING'|'APPROVED'|'REJECTED';version:number;createdAt:string;updatedAt:string;user:UserSummary;shift:Pick<Shift,'id'|'title'|'stage'>;
}
export interface Assignment {
 id:string;userId:string;shiftId:string;position:string;squadId:string|null;createdAt:string;user:UserSummary;shift?:Pick<Shift,'id'|'title'|'stage'>;
}
export interface Staff extends UserSummary {applicationId:string|null;positions:Assignment[]}
export interface History {
 id:string;action:string;entityType:string;entityId:string;createdAt:string;actor:Omit<UserSummary,'role'>;subject?:UserSummary|null;details:{subjectUserId?:string;position?:string;status?:string;from?:string;to?:string}
}
export interface Notification {id:string;kind:string;text:string;readAt:string|null;createdAt:string}

export interface User {
 id:string; username:string|null;firstName:string;lastName:string|null;middleName:string|null;phone:string|null;birthDate:string|null;
 role:'ADMIN'|'LEAD'|'TRAINEE';isOnboarded:boolean;accountStatus:'PENDING'|'CONFIRMED'|'REJECTED';
 creativeTaskUrl:string|null;presentationUrl:string|null;manualShiftsCount:number;manualExperience:string|null;createdAt:string;
}
export interface Shift {
 id:string;title:string;description:string|null;startDate:string;endDate:string;
 visibility:'ADMIN_ONLY'|'ADMIN_LEAD'|'ADMIN_LEAD_TRAINEE';stage:'STAGE_1'|'STAGE_2'|'STAGE_3'|'STAGE_4';leadRecruitOpen:boolean;traineeRecruitOpen:boolean;
}
export interface StaffingInfo {canReview:boolean;canManageRoles:boolean;positions:string[];squads:{id:string;name:string}[]}
export interface Squad {id:string;name:string;color:string|null;sortOrder:number}
export interface Child {id:string;squadId:string;firstName:string;lastName:string;middleName:string|null;birthDate:string|null;building:string|null;room:string|null}
export interface Page<T> {items:T[];total:number;page:number;pageSize:number}
export const roles={ADMIN:'Руководитель',LEAD:'Ведущий',TRAINEE:'Стажёр'};
export const stages={STAGE_1:'Отбор педсостава',STAGE_2:'Отбор стажёров',STAGE_3:'Программа и роли',STAGE_4:'Проведение смены'};
export const visibility={ADMIN_ONLY:'Только руководитель',ADMIN_LEAD:'Руководитель и ведущие',ADMIN_LEAD_TRAINEE:'Вся команда'};
export const dateLabel=(date:string)=>new Date(date).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
export const fullName=(user:Pick<User,'firstName'|'lastName'|'middleName'>)=>[user.lastName,user.firstName,user.middleName].filter(Boolean).join(' ');
