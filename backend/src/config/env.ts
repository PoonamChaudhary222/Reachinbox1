import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  DATABASE_URL: z
    .string()
    .default('mysql://root@127.0.0.1:3307/reachinbox_db'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_CALLBACK_URL: z.string().default('http://localhost:5000/api/auth/google/callback'),

  SESSION_SECRET: z
    .string()
    .min(16)
    .default('reachinbox-dev-session-secret-change-in-prod'),

  ETHEREAL_HOST: z.string().default('smtp.ethereal.email'),
  ETHEREAL_PORT: z.coerce.number().default(587),
  ETHEREAL_USER: z.string().default(''),
  ETHEREAL_PASS: z.string().default(''),

  ELASTICSEARCH_URL: z.string().default('http://localhost:9200'),

  SLACK_CLIENT_ID: z.string().default(''),
  SLACK_CLIENT_SECRET: z.string().default(''),
  SLACK_REDIRECT_URI: z.string().default('http://localhost:5000/api/slack/callback'),

  TOKEN_ENCRYPTION_KEY: z
    .string()
    .default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),

  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(100).default(5),
  MIN_DELAY_BETWEEN_EMAILS: z.coerce.number().int().min(0).default(2000),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.coerce.number().int().min(1).default(100),
  ADMIN_EMAILS: z.string().default(''),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const adminEmailSet = new Set(
  env.ADMIN_EMAILS.split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);
