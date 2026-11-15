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
export const applicationCreateSchema = z.object({type:z.enum(['LEAD_RECRUIT','TRAINEE_RECRUIT'])}).strict();
export const applicationDecisionSchema = z.object({status:z.enum(['APPROVED','REJECTED']),version:z.number().int().min(0)}).strict();
export const recruitmentSchema = z.object({leadRecruitOpen:z.boolean().optional(),traineeRecruitOpen:z.boolean().optional(),stage:z.enum(['STAGE_1','STAGE_2','STAGE_3','STAGE_4']).optional()}).strict().refine(v=>Object.keys(v).length>0,'Укажите хотя бы одно изменение');
export const positionSchema = z.object({userId:z.string().min(1).max(100),position:z.string().trim().min(1).max(120),squadId:z.string().min(1).max(100).nullable().optional()}).strict();
export const detachRoleSchema = z.object({squadId:z.null()}).strict();
export const searchQuery = pagination.extend({search:z.string().trim().max(100).default('')}).strict();
export const notificationIdParam = z.object({id:z.string().min(1).max(100)}).strict();
export const squadCreateSchema = z.object({name:z.string().trim().min(1).max(120),color:z.string().regex(/^#[\\da-f]{6}$/i).nullable().optional(),sortOrder:z.number().int().min(-100000).max(100000).default(0)}).strict();
export const squadUpdateSchema = squadCreateSchema.partial().strict().refine(v=>Object.keys(v).length>0,'������� ���������');
export const staffCreateSchema = z.object({userId:z.string().min(1).max(100),memberType:z.enum(['LEAD','TRAINEE'])}).strict();
export const memberMoveSchema = z.object({squadId:z.string().min(1).max(100)}).strict();
export const paymentSchema = z.object({paymentStatus:z.enum(['UNPAID','PARTIAL','PAID']),paymentNote:z.string().trim().max(500).optional().nullable()}).strict();
export const checkinSchema = z.object({checkinStatus:z.boolean()}).strict();
export const dailyMarkSchema = z.object({date:dateOnly,markType:z.enum(['FULL_DAY','TECHNIC']),note:z.string().trim().max(500).optional().nullable()}).strict();
export const bankEventCreateSchema = z.object({title:z.string().trim().min(1).max(200),description:z.string().trim().max(10000).optional().nullable(),category:z.enum(['FIVE_MIN','ICEBREAKER','EDUCATIONAL','ENTERTAINMENT']),ageGroup:z.string().trim().max(100).optional().nullable(),duration:z.number().int().min(1).max(1440).optional().nullable(),materials:z.string().trim().max(5000).optional().nullable(),tags:z.array(z.string().trim().min(1).max(50)).max(30).default([]),isPublic:z.boolean().default(true)}).strict();
export const bankEventUpdateSchema = bankEventCreateSchema.partial().strict().refine(v=>Object.keys(v).length>0,'Укажите изменения');
export const programItemCreateSchema = z.object({title:z.string().trim().min(1).max(200),description:z.string().trim().max(10000).optional().nullable(),date:dateOnly,startTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),endTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),location:z.string().trim().max(200).optional().nullable(),type:z.enum(['EDUCATIONAL','ENTERTAINMENT']),responsibleId:z.string().min(1).max(100).optional().nullable(),bankEventId:z.string().min(1).max(100).optional().nullable(),sortOrder:z.number().int().min(-100000).max(100000).default(0)}).strict();
export const programItemUpdateSchema = programItemCreateSchema.omit({sortOrder:true}).partial().extend({updatedAt:z.string().datetime(),sortOrder:z.number().int().min(-100000).max(100000).optional()}).strict().refine(v=>Object.keys(v).some(key=>key!=='updatedAt'),'Укажите изменения');
export const programReorderSchema = z.object({items:z.array(z.object({id:z.string().min(1).max(100),sortOrder:z.number().int().min(-100000).max(100000),updatedAt:z.string().datetime()}).strict()).min(1).max(500)}).strict();
export const programProposalCreateSchema = z.object({text:z.string().trim().min(1).max(5000)}).strict();
export const programProposalDecisionSchema = z.object({status:z.enum(['ACCEPTED','REJECTED'])}).strict();
