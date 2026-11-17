import type { Prisma } from '@prisma/client';
import type { Permission } from './permissions.js';

// Календарный день смены не зависит от часового пояса процесса или браузера.
export function shiftCalendarDate(now:Date,timeZone:string):string {
 const parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const part=(type:string)=>parts.find(p=>p.type===type)!.value;
 return `${part('year')}-${part('month')}-${part('day')}`;
}

// Управление само по себе не разрешает чтение состава отрядов.
export function squadScope(granted:ReadonlySet<Permission>,userId:string,shiftId:string):Prisma.SquadWhereInput | null {
 if(granted.has('squad.view_all')) return {shiftId};
 if(granted.has('squad.view_own')) return {shiftId,OR:[{members:{some:{userId,shiftId}}},{roles:{some:{userId,shiftId}}}]};
 return null;
}
