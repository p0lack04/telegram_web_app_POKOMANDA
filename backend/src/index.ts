import { PrismaClient } from '@prisma/client';
import { loadConfig } from './config.js';
import { buildApp } from './app.js';

// Конфигурация валидируется до открытия сокета. Секретные значения не печатаются.
let config;
try { config=loadConfig(); } catch { console.error('Некорректная конфигурация. Проверьте backend/.env по .env.example');process.exit(1); }
const db=new PrismaClient();
const app=await buildApp(config,db);
const shutdown=async()=>{await app.close();await db.$disconnect();};
process.once('SIGINT',()=>{void shutdown();});
process.once('SIGTERM',()=>{void shutdown();});
try {
 await db.$connect();
 await app.listen({port:config.PORT,host:config.HOST});
 console.info(`Komanda API слушает порт ${config.PORT}`);
} catch { console.error('Не удалось запустить API. Проверьте БД, миграции и занятость порта');await shutdown();process.exitCode=1; }
