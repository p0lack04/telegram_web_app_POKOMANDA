import {describe,it,expect} from 'vitest';
import {squadScope,shiftCalendarDate} from '../src/domain/squads.js';
import type {Permission} from '../src/domain/permissions.js';

describe('squad scope',()=>{
 it('не даёт чтение только по manage',()=>expect(squadScope(new Set<Permission>(['squad.manage']),'u','s')).toBeNull());
 it('view_all имеет приоритет над view_own',()=>expect(squadScope(new Set<Permission>(['squad.view_all','squad.view_own']),'u','s')).toEqual({shiftId:'s'}));
});

describe('calendar day in the stored shift timezone',()=>{
 it.each([
  ['2027-12-31T20:59:59.999Z','Europe/Moscow','2027-12-31'],
  ['2027-12-31T21:00:00.000Z','Europe/Moscow','2028-01-01'],
  ['2028-02-29T19:00:00.000Z','Asia/Yekaterinburg','2028-03-01'],
  ['2028-03-01T00:00:00.000Z','America/Los_Angeles','2028-02-29'],
  ['2027-03-14T09:59:59.999Z','America/Los_Angeles','2027-03-14'],
  ['2027-03-14T10:00:00.000Z','America/Los_Angeles','2027-03-14'],
 ])('%s in %s is %s',(instant,zone,expected)=>expect(shiftCalendarDate(new Date(instant),zone)).toBe(expected));
});
