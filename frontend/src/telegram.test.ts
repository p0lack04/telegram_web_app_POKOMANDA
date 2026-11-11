import {afterEach,describe,it,expect,vi} from 'vitest';
import {telegram} from './telegram';
afterEach(()=>vi.unstubAllGlobals());
describe('Telegram context',()=>{
 it('не выдаёт браузерный скрипт без initData за Telegram host',()=>{vi.stubGlobal('window',{Telegram:{WebApp:{initData:'',colorScheme:'light'}}});expect(telegram()).toBeUndefined();});
 it('возвращает host с raw initData',()=>{const host={initData:'signed',colorScheme:'dark'};vi.stubGlobal('window',{Telegram:{WebApp:host}});expect(telegram()).toBe(host);});
});
