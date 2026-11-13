import type { Prisma } from '@prisma/client';
import type { Permission } from './permissions.js';

// Управление само по себе не разрешает чтение состава отрядов.
export function squadScope(granted:ReadonlySet<Permission>,userId:string,shiftId:string):Prisma.SquadWhereInput | null {
 if(granted.has('squad.view_all')) return {shiftId};
 if(granted.has('squad.view_own')) return {shiftId,OR:[{members:{some:{userId,shiftId}}},{roles:{some:{userId,shiftId}}}]};
 return null;
}
