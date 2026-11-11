import { z } from 'zod';

const schema = z.object({
 NODE_ENV: z.enum(['development','test','production']).default('development'),
 PORT: z.coerce.number().int().min(1).max(65535).default(3001),
 HOST: z.string().default('127.0.0.1'),
 DATABASE_URL: z.string().url().refine(v => /^postgres(ql)?:/.test(v), 'PostgreSQL URL required'),
 APP_ORIGIN: z.string().url(),
 TELEGRAM_BOT_TOKEN: z.string().regex(/^\d+:[A-Za-z0-9_-]{30,}$/),
});
export type Config = z.infer<typeof schema>;
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
 const config = schema.parse(env);
 const origin = new URL(config.APP_ORIGIN);
 if(origin.origin !== config.APP_ORIGIN) throw new Error('APP_ORIGIN must be an origin without a path or trailing slash');
 if(config.NODE_ENV === 'production' && origin.protocol !== 'https:') throw new Error('Production requires HTTPS APP_ORIGIN');
 return config;
}
