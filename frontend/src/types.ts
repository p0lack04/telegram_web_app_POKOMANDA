export interface User {
 id:string; username:string|null;firstName:string;lastName:string|null;middleName:string|null;phone:string|null;birthDate:string|null;
 role:'ADMIN'|'LEAD'|'TRAINEE';isOnboarded:boolean;accountStatus:'PENDING'|'CONFIRMED'|'REJECTED';
 creativeTaskUrl:string|null;presentationUrl:string|null;manualShiftsCount:number;manualExperience:string|null;createdAt:string;
}
export interface Shift {
 id:string;title:string;description:string|null;startDate:string;endDate:string;
 visibility:'ADMIN_ONLY'|'ADMIN_LEAD'|'ADMIN_LEAD_TRAINEE';stage:'STAGE_1'|'STAGE_2'|'STAGE_3'|'STAGE_4';leadRecruitOpen:boolean;traineeRecruitOpen:boolean;
}
export interface Page<T> {items:T[];total:number;page:number;pageSize:number}
export const roles={ADMIN:'Руководитель',LEAD:'Ведущий',TRAINEE:'Стажёр'};
export const stages={STAGE_1:'Отбор педсостава',STAGE_2:'Отбор стажёров',STAGE_3:'Программа и роли',STAGE_4:'Проведение смены'};
export const visibility={ADMIN_ONLY:'Только руководитель',ADMIN_LEAD:'Руководитель и ведущие',ADMIN_LEAD_TRAINEE:'Вся команда'};
export const dateLabel=(date:string)=>new Date(date).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
export const fullName=(user:User)=>[user.lastName,user.firstName,user.middleName].filter(Boolean).join(' ');
