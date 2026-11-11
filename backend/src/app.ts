import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { Prisma, type PrismaClient } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError, requireRule } from './errors.js';
import type { Config } from './config.js';
import { AuthService } from './services/auth.js';
import { registerRoutes } from './routes/index.js';

export async function buildApp(config:Config,db:PrismaClient) {
 // HTTP request logging отключён: URL/headers/body могут содержать PII и секреты.
 const app=Fastify({logger:false,bodyLimit:32768,trustProxy:false});
 await app.register(cookie);
 await app.register(helmet,{contentSecurityPolicy:false});
 await app.register(rateLimit,{max:120,timeWindow:'1 minute'});
 app.addHook('onRequest',async(request,reply)=>{
  reply.header('Cache-Control','no-store');
  if(!['GET','HEAD','OPTIONS'].includes(request.method)) {
   requireRule(request.headers.origin===config.APP_ORIGIN,403,'INVALID_ORIGIN','Запрос разрешён только из приложения');
   requireRule(!request.headers['sec-fetch-site'] || ['same-origin','none'].includes(String(request.headers['sec-fetch-site'])),403,'CROSS_SITE_REQUEST','Межсайтовый запрос запрещён');
  }
 });
 app.setErrorHandler((error,request,reply)=>{
  if(error instanceof ZodError) return reply.code(400).send({error:{code:'VALIDATION_ERROR',message:'Проверьте обязательные поля и формат данных',requestId:request.id}});
  if(error instanceof AppError) return reply.code(error.status).send({error:{code:error.code,message:error.message,requestId:request.id}});
  if(error instanceof Prisma.PrismaClientKnownRequestError && ['P2002','P2003','P2025'].includes(error.code)) return reply.code(409).send({error:{code:'DATA_CONFLICT',message:'Данные изменились или связаны с другой записью. Обновите страницу',requestId:request.id}});
  const candidate=error instanceof Error && 'statusCode' in error ? error.statusCode:undefined;
  const status=typeof candidate==='number' && candidate>=400 && candidate<500 ? candidate:500;
  return reply.code(status).send({error:{code:status===500?'INTERNAL_ERROR':'REQUEST_ERROR',message:status===500?'Не удалось выполнить запрос':'Запрос отклонён',requestId:request.id}});
 });
 app.setNotFoundHandler((request,reply)=>reply.code(404).send({error:{code:'NOT_FOUND',message:'Маршрут не найден',requestId:request.id}}));
 registerRoutes(app,db,new AuthService(db,config.TELEGRAM_BOT_TOKEN),config);
 return app;
}
