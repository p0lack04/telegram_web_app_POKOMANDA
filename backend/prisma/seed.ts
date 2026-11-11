import { PrismaClient } from '@prisma/client';

if(!['development','test'].includes(process.env.NODE_ENV??'')) throw new Error('Seed разрешён только при явном NODE_ENV=development/test');
const id=process.env.ADMIN_TELEGRAM_ID;
if(!id || !/^[1-9]\d{0,15}$/.test(id) || !Number.isSafeInteger(Number(id))) throw new Error('Задайте ADMIN_TELEGRAM_ID для своего dev Telegram аккаунта');
const db=new PrismaClient();
try {
 await db.user.upsert({where:{telegramId:BigInt(id)},update:{role:'ADMIN',accountStatus:'CONFIRMED'},create:{telegramId:BigInt(id),firstName:'Разработчик',role:'ADMIN',accountStatus:'CONFIRMED'}});
 console.info('Dev-руководитель подготовлен. Войдите через Telegram и заполните профиль.');
} finally {await db.$disconnect();}
