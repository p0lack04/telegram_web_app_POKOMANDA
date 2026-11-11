import { chromium, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import EmbeddedPostgres from 'embedded-postgres';
import { createServer as createVite } from 'vite';
import { createServer } from 'node:net';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { buildApp } from '../backend/dist/app.js';

// Только синтетические fixtures в отдельной временной PostgreSQL. Ни dev-login,
// ни подмена HTTP не добавляются в приложение; браузер работает с реальным API.
const listener=createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
const directory=await mkdtemp(join(tmpdir(),'komanda-browser-'));
const password=randomBytes(20).toString('hex');
const pg=new EmbeddedPostgres({databaseDir:join(directory,'data'),user:'postgres',password,port,persistent:false,autoRehydrateSymlinks:true,postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{}});
let db,app,vite,browser;
try {
 await pg.initialise();await pg.start();await pg.createDatabase('komanda_browser');
 const url=`postgresql://postgres:${password}@127.0.0.1:${port}/komanda_browser`;
 execFileSync(process.execPath,[resolve('node_modules/prisma/build/index.js'),'migrate','deploy','--schema',resolve('backend/prisma/schema.prisma')],{env:{...process.env,DATABASE_URL:url},stdio:'pipe'});
 db=new PrismaClient({datasources:{db:{url}}});
 vite=await createVite({root:resolve('frontend'),configFile:resolve('frontend/vite.config.ts'),server:{host:'127.0.0.1',port:0}});await vite.listen();
 const origin=`http://127.0.0.1:${vite.httpServer.address().port}`;
 app=await buildApp({NODE_ENV:'test',PORT:3001,HOST:'127.0.0.1',DATABASE_URL:url,APP_ORIGIN:origin,TELEGRAM_BOT_TOKEN:'123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijk'},db);
 await app.listen({host:'127.0.0.1',port:0});
 // Переопределение proxy до первого запроса, не подмена ответа API.
 vite.config.server.proxy['/api']=`http://127.0.0.1:${app.server.address().port}`;
 // Vite proxy создаётся при listen, поэтому перезапускаем с конечным target.
 await vite.close();
 const webPort=Number(new URL(origin).port);
 vite=await createVite({root:resolve('frontend'),configFile:resolve('frontend/vite.config.ts'),server:{host:'127.0.0.1',port:webPort,strictPort:true,proxy:{'/api':`http://127.0.0.1:${app.server.address().port}`}}});await vite.listen();
 browser=await chromium.launch();await mkdir('test-results',{recursive:true});
 const errors=[];
 async function contextFor(role,id,status='CONFIRMED') {
  const user=await db.user.create({data:{telegramId:BigInt(id),firstName:'Тест',lastName:'Участник',role,isOnboarded:true,accountStatus:status}});
  const token=randomBytes(32).toString('base64url');await db.session.create({data:{userId:user.id,tokenHash:createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+3600000)}});
  const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:'light'});
  await context.addCookies([{name:'komanda_session',value:token,url:origin,httpOnly:true,sameSite:'Strict'}]);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {context,page,user};
 }
 const admin=await contextFor('ADMIN',701);
 await admin.page.goto(origin);await expect(admin.page.getByRole('heading',{name:'Главная',exact:true})).toBeVisible();
 await admin.page.getByRole('navigation').getByRole('button',{name:'Смены'}).click();
 await admin.page.getByRole('button',{name:'+ Создать'}).click();
 await admin.page.getByLabel('Название *').fill('Проверочная смена');
 await admin.page.getByLabel('Начало *').fill('2027-06-01');await admin.page.getByLabel('Окончание *').fill('2027-06-15');
 await admin.page.getByLabel('Кому доступна смена').selectOption('ADMIN_LEAD_TRAINEE');
 await admin.page.getByRole('button',{name:'Создать смену',exact:true}).click();
 await expect(admin.page.getByRole('heading',{name:'Проверочная смена',level:2})).toBeVisible();
 expect(await db.shift.count({where:{title:'Проверочная смена'}})).toBe(1);
 await admin.page.screenshot({path:'test-results/admin-shift-mobile.png',fullPage:true});
 const trainee=await contextFor('TRAINEE',702);
 await trainee.page.goto(origin);await trainee.page.getByRole('navigation').getByRole('button',{name:'Смены'}).click();
 await expect(trainee.page.getByRole('button',{name:/Проверочная смена/})).toBeVisible();
 await expect(trainee.page.getByRole('button',{name:'+ Создать'})).toHaveCount(0);
 await trainee.page.getByRole('button',{name:/Проверочная смена/}).click();
 await expect(trainee.page.getByRole('heading',{name:'Проверочная смена',level:2})).toBeVisible();
 const lead=await contextFor('LEAD',703);await lead.page.goto(origin);
 await expect(lead.page.getByText('Ведущий',{exact:true})).toBeVisible();
 await lead.page.emulateMedia({colorScheme:'dark'});
 await expect.poll(()=>lead.page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--bg').trim())).toBe('#111b16');
 await lead.page.evaluate(()=>document.getAnimations().forEach(animation=>animation.finish()));
 await lead.page.screenshot({path:'test-results/lead-home-dark-mobile.png',fullPage:true});
 const pending=await contextFor('TRAINEE',704,'PENDING');await pending.page.goto(origin);
 await expect(pending.page.getByRole('button',{name:'Проверить статус'})).toBeVisible();
 await admin.page.getByRole('navigation').getByRole('button',{name:'Анкеты'}).click();
 await admin.page.getByRole('button',{name:'Принять',exact:true}).click();
 await admin.page.getByRole('button',{name:'Подтвердить решение'}).click();
 await expect(admin.page.getByText('Решение сохранено.')).toBeVisible();
 await pending.page.getByRole('button',{name:'Проверить статус'}).click();
 await expect(pending.page.getByRole('heading',{name:'Главная',exact:true})).toBeVisible();
 const guest=await browser.newContext({viewport:{width:320,height:700}});const guestPage=await guest.newPage();
 await guestPage.goto(origin);await expect(guestPage.getByRole('heading',{name:/Хорошие смены/})).toBeVisible();
 await guestPage.screenshot({path:'test-results/guest-320.png',fullPage:true});
 for(const page of [admin.page,trainee.page,lead.page,pending.page,guestPage]) expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 expect(errors).toEqual([]);
 console.info('Browser smoke passed: ADMIN create/persist, TRAINEE visibility, LEAD dark, pending approve/refresh, guest 320px, no overflow/page errors.');
} finally {
 if(browser)await browser.close();if(vite)await vite.close();if(app)await app.close();if(db)await db.$disconnect();await pg.stop();
}
