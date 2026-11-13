import {describe,it,expect} from 'vitest';
import {squadScope} from '../src/domain/squads.js';
import type {Permission} from '../src/domain/permissions.js';

describe('squad scope',()=>{
 it('не даёт чтение только по manage',()=>expect(squadScope(new Set<Permission>(['squad.manage']),'u','s')).toBeNull());
 it('view_all имеет приоритет над view_own',()=>expect(squadScope(new Set<Permission>(['squad.view_all','squad.view_own']),'u','s')).toEqual({shiftId:'s'}));
});
