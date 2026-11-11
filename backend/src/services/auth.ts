import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient, User } from '@prisma/client';
import { AppError, requireRule } from '../errors.js';
import { verifyTelegramInitData } from '../lib/telegram-auth.js';

export const hashToken = (value:string) => createHash('sha256').update(value).digest('hex');
export class AuthService {
 constructor(private db:PrismaClient,private botToken:string) {}
 async login(initData:string) {
  const telegram = verifyTelegramInitData(initData,this.botToken);
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now()+12*60*60*1000);
  try {
   const user = await this.db.$transaction(async tx => {
    // Digest уникален: параллельные повторы откатываются вместе с сессией.
    await tx.telegramReplay.create({data:{digest:hashToken(new URLSearchParams(initData).get('hash')!.toLowerCase()),expiresAt:new Date(Date.now()+10*60*1000)}});
    const user = await tx.user.upsert({where:{telegramId:BigInt(telegram.id)},
     update:{username:telegram.username??null},
     create:{telegramId:BigInt(telegram.id),username:telegram.username??null,firstName:telegram.first_name,lastName:telegram.last_name??null}});
    await tx.session.create({data:{tokenHash:hashToken(token),userId:user.id,expiresAt}});
    return user;
   });
   return {user,token,expiresAt};
  } catch(error) {
   if(error instanceof Error && 'code' in error && error.code==='P2002') throw new AppError(401,'INIT_DATA_REPLAY','Повторный вход с этими данными запрещён. Откройте приложение заново из Telegram');
   throw error;
  }
 }
 async authenticate(token:string|undefined):Promise<User> {
  requireRule(token && /^[A-Za-z0-9_-]{43}$/.test(token),401,'UNAUTHORIZED','Откройте приложение из Telegram');
  const session = await this.db.session.findUnique({where:{tokenHash:hashToken(token)},include:{user:true}});
  requireRule(session && session.expiresAt.getTime()>Date.now(),401,'UNAUTHORIZED','Сессия истекла. Откройте приложение заново');
  return session.user;
 }
 async logout(token:string|undefined) {
  if(token) await this.db.session.deleteMany({where:{tokenHash:hashToken(token)}});
 }
}
