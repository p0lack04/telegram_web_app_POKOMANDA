import {describe,it,expect} from 'vitest';
import {applicationTypeFor,requireKnownPosition} from '../src/domain/staffing.js';
import {applicationCreateSchema,applicationDecisionSchema,recruitmentSchema,positionSchema} from '../src/domain/schemas.js';

describe('staffing policies',()=>{
 it('отделяет глобальную роль от типа заявки',()=>{expect(applicationTypeFor('LEAD')).toBe('LEAD_RECRUIT');expect(applicationTypeFor('TRAINEE')).toBe('TRAINEE_RECRUIT');expect(()=>applicationTypeFor('ADMIN')).toThrow();});
 it.each(['__proto__','toString','ADMIN','Неизвестно'])('не доверяет должности %s',value=>expect(()=>requireKnownPosition(value,'ADMIN')).toThrow());
 it('заместитель не назначает руководителя',()=>{expect(()=>requireKnownPosition('Руководитель','LEAD')).toThrow();expect(()=>requireKnownPosition('Руководитель','ADMIN')).not.toThrow();});
 it('решение принимает только status и version',()=>{expect(applicationDecisionSchema.safeParse({status:'PENDING',version:0}).success).toBe(false);expect(applicationDecisionSchema.safeParse({status:'APPROVED'}).success).toBe(false);expect(applicationDecisionSchema.safeParse({status:'APPROVED',version:0,userId:'other'}).success).toBe(false);});
 it('create не принимает чужую identity',()=>expect(applicationCreateSchema.safeParse({type:'TRAINEE_RECRUIT',userId:'other'}).success).toBe(false));
 it('recruitment отклоняет пустые или чужие поля',()=>{expect(recruitmentSchema.safeParse({}).success).toBe(false);expect(recruitmentSchema.safeParse({visibility:'ADMIN_ONLY'}).success).toBe(false);});
 it('assignment не допускает пустой squad ID',()=>expect(positionSchema.safeParse({userId:'u',position:'Стажёр',squadId:''}).success).toBe(false));
});
