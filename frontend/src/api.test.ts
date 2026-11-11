import {describe,it,expect,afterEach,vi} from 'vitest';
import {api,ApiError} from './api';

afterEach(()=>vi.unstubAllGlobals());
describe('HTTP client',()=>{
 it('передаёт cookie без client token',async()=>{const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({user:{id:'u'}}),{status:200}));vi.stubGlobal('fetch',fetcher);await api('/auth/telegram',{initData:'signed'});expect(fetcher).toHaveBeenCalledWith('/api/auth/telegram',expect.objectContaining({credentials:'include',method:'POST'}));expect(fetcher.mock.calls[0]?.[1]?.headers).not.toHaveProperty('Authorization');});
 it('разбирает серверный error envelope',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{code:'FORBIDDEN',message:'Нет доступа'}}),{status:403})));await expect(api('/shifts')).rejects.toMatchObject({status:403,code:'FORBIDDEN',message:'Нет доступа'});});
 it('показывает сетевую ошибку',async()=>{vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('network')));await expect(api('/auth/me')).rejects.toBeInstanceOf(ApiError);});
 it('принимает logout 204',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(null,{status:204})));await expect(api('/auth/logout',{})).resolves.toBeUndefined();});
});
