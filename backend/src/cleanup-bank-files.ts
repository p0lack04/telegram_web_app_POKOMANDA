import {PrismaClient} from '@prisma/client';
import {loadConfig} from './config.js';
import {fileDependencies} from './integrations/bank-files.js';
import {BankFilesService} from './services/bank-files.js';
const db=new PrismaClient();
try{const service=new BankFilesService(db,fileDependencies(loadConfig()));const result=await service.cleanup();console.info(JSON.stringify(result));if(result.failed)process.exitCode=1;}catch{console.error('Очистка файлов не завершена. Проверьте конфигурацию и доступность сервисов.');process.exitCode=1;}finally{await db.$disconnect();}
