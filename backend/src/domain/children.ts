import {z} from 'zod';
import {dateOnly} from './schemas.js';

const id=z.string().min(1).max(100);
const name=z.string().transform(v=>v.normalize('NFC').trim().replace(/\s+/gu,' ')).pipe(z.string().min(1).max(100));
const placement=z.string().transform(v=>v.normalize('NFC').trim().replace(/\s+/gu,' ')).pipe(z.string().max(100)).nullable();
export const childCreateSchema=z.object({firstName:name,lastName:name,middleName:name.nullable().optional(),birthDate:dateOnly}).strict();
export const childPlacementSchema=z.object({squadId:id.optional(),building:placement.optional(),room:placement.optional()}).strict().refine(v=>Object.keys(v).length>0);
export const childSquadParams=z.object({id,squadId:id}).strict();
export const childParams=childSquadParams.extend({memberId:id}).strict();
