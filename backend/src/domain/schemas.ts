import { z } from 'zod';

// YYYY-MM-DD не нормализуется Date автоматически: 31 февраля должен быть ошибкой.
export const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
 const date = new Date(value+'T00:00:00.000Z');
 return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
},'Некорректная календарная дата');
const text = z.string().trim().min(1).max(100);
const optionalText = z.string().trim().max(200).optional();
const httpUrl = z.string().url().max(2048).refine(value => {
 const url = new URL(value); return ['http:','https:'].includes(url.protocol) && !url.username && !url.password;
},'Ожидается HTTP(S) ссылка без логина и пароля');
export const onboardingSchema = z.object({
 firstName:text,lastName:text,middleName:optionalText,birthDate:dateOnly,
 phone:z.string().trim().max(30).optional(),manualShiftsCount:z.number().int().min(0).max(1000).default(0),
 manualExperience:optionalText, creativeTaskUrl:httpUrl.optional(),presentationUrl:httpUrl.optional(),confirmed:z.boolean(),
}).strict().refine(value => {
 const now = new Date(); const birth = new Date(value.birthDate+'T00:00:00Z');
 let age=now.getUTCFullYear()-birth.getUTCFullYear();
 if(now.getUTCMonth()<birth.getUTCMonth() || (now.getUTCMonth()===birth.getUTCMonth() && now.getUTCDate()<birth.getUTCDate())) age--;
 return age >= 14 && age <= 100;
},'Регистрация доступна с 14 лет; проверьте дату рождения');
export const shiftSchema = z.object({
 title:z.string().trim().min(1).max(160),description:z.string().trim().max(5000).optional(),
 startDate:dateOnly,endDate:dateOnly,
 visibility:z.enum(['ADMIN_ONLY','ADMIN_LEAD','ADMIN_LEAD_TRAINEE']).default('ADMIN_ONLY'),
}).strict().refine(v=>v.endDate>=v.startDate,'Окончание не может быть раньше начала');
export const pagination = z.object({page:z.coerce.number().int().min(1).max(10000).default(1),pageSize:z.coerce.number().int().min(1).max(100).default(20)}).strict();
export const idParam = z.object({id:z.string().min(1).max(100)}).strict();
