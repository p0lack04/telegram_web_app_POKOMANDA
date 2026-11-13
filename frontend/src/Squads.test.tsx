import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {ApiError} from './api';
import {Squads,SquadDetail,safeSquadColor,squadKeys} from './Squads';

const squad={id:'one',name:'Первый отряд',color:'#123abc',sortOrder:2};
const page={items:[squad],total:21,page:1,pageSize:20};
function client(){return new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});}
function render(c:QueryClient,detail=false){return renderToStaticMarkup(<QueryClientProvider client={c}>{detail?<SquadDetail shiftId="shift" squadId="one"/>:<Squads shiftId="shift" open={()=>{}}/>}</QueryClientProvider>);}
async function fail(c:QueryClient,key:readonly unknown[],status:number){await c.invalidateQueries({queryKey:key});await c.fetchQuery({queryKey:key,queryFn:()=>Promise.reject(new ApiError(status,'ERROR','private')),retry:false}).catch(()=>{});}

describe('Отряды',()=>{
 it('показывает загрузку и пустой список',()=>{const c=client();expect(render(c)).toContain('Загружаем отряды');c.setQueryData(squadKeys.list('shift',1),{...page,items:[],total:0});expect(render(c)).toContain('Доступных отрядов пока нет');});
 it('показывает карточку и пагинацию без персональных данных',()=>{const c=client();c.setQueryData(squadKeys.list('shift',1),page);const html=render(c);expect(html).toContain('Первый отряд');expect(html).toContain('Порядок: 2');expect(html).toContain('Страница 1');expect(html).toContain('Далее');expect(html).not.toContain('staff');});
 it('показывает деталь независимо от списка',()=>{const c=client();expect(render(c,true)).toContain('Загружаем отряды');c.setQueryData(squadKeys.detail('shift','one'),{squad});expect(render(c,true)).toContain('Первый отряд');});
 it.each([403,404,500])('скрывает устаревший список и деталь после ошибки %i и предлагает повтор',async status=>{for(const detail of [false,true]){const c=client();const key=detail?squadKeys.detail('shift','one'):squadKeys.list('shift',1);c.setQueryData(key,detail?{squad}:page);await fail(c,key,status);const html=render(c,detail);expect(html).not.toContain('Первый отряд');expect(html).toContain('Повторить');expect(html).toContain(status===403?'Нет доступа':status===404?'не найдены':'Не удалось загрузить');}});
 it('изолирует ключи смен и деталь от списка',()=>{expect(squadKeys.list('a',1)).not.toEqual(squadKeys.list('b',1));expect(squadKeys.detail('a','one')).not.toEqual(squadKeys.list('a',1));});
 it('принимает только безопасный шестизначный hex',()=>{expect(safeSquadColor('#aBc123')).toBe('#aBc123');for(const color of ['red','#fff','url(x)','#000000; color:red',''])expect(safeSquadColor(color)).toBeUndefined();expect(safeSquadColor(null)).toBeUndefined();});
});
