import { createHmac } from 'node:crypto';
import { describe,it,expect } from 'vitest';
import { verifyTelegramInitData } from '../src/lib/telegram-auth.js';

const token='123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijk';const now=1800000000;
function sign(data:Record<string,string>) {
 const params=new URLSearchParams(data);
 const key=createHmac('sha256','WebAppData').update(token).digest();
 const check=[...params].sort(([a],[b])=>a<b?-1:1).map(([k,v])=>`${k}=${v}`).join('\n');
 params.set('hash',createHmac('sha256',key).update(check).digest('hex'));return params.toString();
}
const payload={auth_date:String(now),user:JSON.stringify({id:42,first_name:'Тест'}),query_id:'sample'};
describe('Telegram HMAC',()=>{
 it('принимает корректную подписанную identity',()=>expect(verifyTelegramInitData(sign(payload),token,now).id).toBe(42));
 it('учитывает signature в HMAC data-check-string',()=>expect(verifyTelegramInitData(sign({...payload,signature:'signed-value'}),token,now).id).toBe(42));
 it('не принимает подменённого пользователя',()=>expect(()=>verifyTelegramInitData(sign(payload).replace('sample','modified'),token,now)).toThrow());
 it.each(['','NaN','Infinity','-1',String(now+1),String(now-301)])('отклоняет auth_date %s',auth_date=>expect(()=>verifyTelegramInitData(sign({...payload,auth_date}),token,now)).toThrow());
 it('отклоняет неверный токен бота',()=>expect(()=>verifyTelegramInitData(sign(payload),'another',now)).toThrow());
 it('отклоняет дублированные ключи',()=>expect(()=>verifyTelegramInitData(sign(payload)+'&auth_date='+now,token,now)).toThrow());
 it.each([{}, {id:-1,first_name:'Тест'},{id:1.5,first_name:'Тест'},{id:42,is_bot:true,first_name:'Бот'}])('отклоняет некорректную identity',user=>expect(()=>verifyTelegramInitData(sign({...payload,user:JSON.stringify(user)}),token,now)).toThrow());
 it('отклоняет произвольный ID вместо initData',()=>expect(()=>verifyTelegramInitData('42',token,now)).toThrow());
 it('отклоняет неверный hash',()=>expect(()=>verifyTelegramInitData(sign(payload).replace(/hash=.{64}/,'hash=bad'),token,now)).toThrow());
 it('отклоняет слишком длинный initData',()=>expect(()=>verifyTelegramInitData('x'.repeat(17000),token,now)).toThrow());
});
