import type { User, Squad } from '@prisma/client';

/** Явный DTO: BigInt, служебные ID подтверждения и связи не уходят в JSON. */
export function selfDto(user:User) {
 return {id:user.id,username:user.username,firstName:user.firstName,lastName:user.lastName,middleName:user.middleName,
 phone:user.phone,birthDate:user.birthDate,role:user.role,isOnboarded:user.isOnboarded,accountStatus:user.accountStatus,
 creativeTaskUrl:user.creativeTaskUrl,presentationUrl:user.presentationUrl,manualShiftsCount:user.manualShiftsCount,
 manualExperience:user.manualExperience,createdAt:user.createdAt};
}

/** Отдельный allowlist не позволяет расширению persistence-запроса расширить API. */
export function squadDto(squad:Pick<Squad,'id'|'name'|'color'|'sortOrder'>) {
 return {id:squad.id,name:squad.name,color:squad.color,sortOrder:squad.sortOrder};
}
