import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../errors.js';

const telegramUser = z.object({
 id: z.number().int().positive().safe(), first_name: z.string().min(1).max(256),
 last_name: z.string().max(256).optional(), username: z.string().max(64).optional(),
 is_bot: z.boolean().optional(),
});
export type TelegramUser = z.infer<typeof telegramUser>;
/** HMAC-вариант Telegram: signature (если передан) остаётся в data-check-string. */
export function verifyTelegramInitData(initData: string, botToken: string, nowSeconds = Math.floor(Date.now()/1000)): TelegramUser {
 const invalid = () => new AppError(401,'INVALID_INIT_DATA','Данные входа Telegram недействительны или устарели');
 if (!initData || Buffer.byteLength(initData) > 16384) throw invalid();
 const params = new URLSearchParams(initData);
 const keys = [...params.keys()];
 if(new Set(keys).size !== keys.length) throw invalid();
 const hash = params.get('hash');
 if(!hash || !/^[a-fA-F0-9]{64}$/.test(hash)) throw invalid();
 const date = params.get('auth_date');
 if(!date || !/^\d{1,12}$/.test(date)) throw invalid();
 const age = nowSeconds-Number(date);
 if(age < 0 || age > 300) throw invalid();
 const check = [...params.entries()].filter(([key])=>key !== 'hash')
  .sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,value])=>`${key}=${value}`).join('\n');
 const key = createHmac('sha256','WebAppData').update(botToken).digest();
 const expected = createHmac('sha256',key).update(check).digest();
 if(!timingSafeEqual(expected,Buffer.from(hash,'hex'))) throw invalid();
 try {
  const user = telegramUser.parse(JSON.parse(params.get('user') ?? 'null'));
  if(user.is_bot) throw invalid();
  return user;
 } catch { throw invalid(); }
}
