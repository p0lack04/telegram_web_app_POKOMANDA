import {describe,it,expect,afterEach,vi} from 'vitest';
import {api,ApiError} from './api';

afterEach(()=>vi.unstubAllGlobals());
describe('HTTP client',()=>{
 it('передаёт cookie без client token',async()=>{const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({user:{id:'u'}}),{status:200}));vi.stubGlobal('fetch',fetcher);await api('/auth/telegram',{initData:'signed'});expect(fetcher).toHaveBeenCalledWith('/api/auth/telegram',expect.objectContaining({credentials:'include',method:'POST'}));expect(fetcher.mock.calls[0]?.[1]?.headers).not.toHaveProperty('Authorization');});
 it('разбирает серверный error envelope',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{code:'FORBIDDEN',message:'Нет доступа'}}),{status:403})));await expect(api('/shifts')).rejects.toMatchObject({status:403,code:'FORBIDDEN',message:'Нет доступа'});});
 it('показывает сетевую ошибку',async()=>{vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('network')));await expect(api('/auth/me')).rejects.toBeInstanceOf(ApiError);});
 it('передаёт PATCH с версией заявки',async()=>{const fetcher=vi.fn().mockResolvedValue(new Response('{}'));vi.stubGlobal('fetch',fetcher);await api('/applications/a',{status:'APPROVED',version:3},'PATCH');expect(fetcher).toHaveBeenCalledWith('/api/applications/a',expect.objectContaining({method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'APPROVED',version:3})}));});
 it('передаёт DELETE с пустым JSON и принимает 204',async()=>{const fetcher=vi.fn().mockResolvedValue(new Response(null,{status:204}));vi.stubGlobal('fetch',fetcher);await expect(api('/shifts/s/roles/r',undefined,'DELETE')).resolves.toBeUndefined();expect(fetcher).toHaveBeenCalledWith('/api/shifts/s/roles/r',expect.objectContaining({method:'DELETE',body:'{}',headers:{'Content-Type':'application/json'}}));});
 it('явный GET не отправляет тело',async()=>{const fetcher=vi.fn().mockResolvedValue(new Response('{}'));vi.stubGlobal('fetch',fetcher);await api('/shifts',{},'GET');expect(fetcher).toHaveBeenCalledWith('/api/shifts',expect.objectContaining({method:'GET',body:undefined,headers:{}}));});
 it('сохраняет конфликт версии из API',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{code:'VERSION_CONFLICT',message:'Заявка уже изменена'}}),{status:409})));await expect(api('/applications/a',{status:'REJECTED',version:1},'PATCH')).rejects.toMatchObject({status:409,code:'VERSION_CONFLICT'});});
 it('принимает logout 204',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(null,{status:204})));await expect(api('/auth/logout',{})).resolves.toBeUndefined();});
});
