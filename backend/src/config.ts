import { z } from 'zod';

const schema = z.object({
 NODE_ENV: z.enum(['development','test','production']).default('development'),
 PORT: z.coerce.number().int().min(1).max(65535).default(3001),
 HOST: z.string().default('127.0.0.1'),
 DATABASE_URL: z.string().url().refine(v => /^postgres(ql)?:/.test(v), 'PostgreSQL URL required'),
 APP_ORIGIN: z.string().url(),
 TELEGRAM_BOT_TOKEN: z.string().regex(/^\d+:[A-Za-z0-9_-]{30,}$/),
 S3_ENDPOINT:z.string().url().optional(),
 S3_REGION:z.string().min(1).optional(),
 S3_BUCKET:z.string().min(3).max(63).optional(),
 S3_ACCESS_KEY_ID:z.string().min(1).optional(),
 S3_SECRET_ACCESS_KEY:z.string().min(1).optional(),
 CLAMAV_HOST:z.string().min(1).optional(),
 CLAMAV_PORT:z.coerce.number().int().min(1).max(65535).optional(),
});
export type Config = z.infer<typeof schema>;
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
 const config = schema.parse(env);
 const fileSettings=[config.S3_ENDPOINT,config.S3_BUCKET,config.S3_ACCESS_KEY_ID,config.S3_SECRET_ACCESS_KEY,config.CLAMAV_HOST];
 if(fileSettings.some(Boolean)&&!fileSettings.every(Boolean))throw new Error('Incomplete private file configuration');
 if(config.S3_ENDPOINT){const endpoint=new URL(config.S3_ENDPOINT);if(endpoint.username||endpoint.password||!['http:','https:'].includes(endpoint.protocol))throw new Error('Invalid storage endpoint');if(config.NODE_ENV==='production'&&endpoint.protocol!=='https:')throw new Error('Production storage requires HTTPS');}
 const origin = new URL(config.APP_ORIGIN);
 if(origin.origin !== config.APP_ORIGIN) throw new Error('APP_ORIGIN must be an origin without a path or trailing slash');
 if(config.NODE_ENV === 'production' && origin.protocol !== 'https:') throw new Error('Production requires HTTPS APP_ORIGIN');
 return config;
}
