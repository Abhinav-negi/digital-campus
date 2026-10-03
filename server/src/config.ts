import { z } from 'zod';

// Keys mirror .env.example (OPS-02). Prod differs by env vars only (ARCH §13).
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.url(),
  TEST_DATABASE_URL: z.url().optional(),
  APP_URL: z.url(),
  PORT: z.coerce.number().int().default(3000),
  COOKIE_SECURE: z.stringbool().default(false),
  SESSION_DAYS: z.coerce.number().int().positive().default(30),
  SMTP_HOST: z.string().default(''), // empty = mail printed to the server log (D14)
  SMTP_PORT: z.coerce.number().int(),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().min(1),
  S3_ENDPOINT: z.url().optional(), // unset = local disk in .data/uploads (D14)
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().default(''),
  S3_SECRET_KEY: z.string().default(''),
  S3_FORCE_PATH_STYLE: z.stringbool().default(false),
  ANTHROPIC_API_KEY: z.string().default(''), // empty = document import disabled
  IMPORT_MODEL: z.string().default('claude-sonnet-5-5'),
  INSTITUTION_TZ: z.string().default('Asia/Kolkata'),
});

// Treat `KEY=` as unset so optional/default keys behave.
const env = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ''));
const parsed = schema.safeParse(env);
if (!parsed.success) {
  console.error(`Invalid environment (see .env.example):\n${z.prettifyError(parsed.error)}`);
  process.exit(1);
}

export const config = parsed.data;
