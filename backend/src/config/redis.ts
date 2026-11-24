import IORedis, { RedisOptions } from 'ioredis';
import { env } from './env';

export function buildRedisOptions(forBullMQ = false): RedisOptions {
  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: forBullMQ ? null : 3,
    enableReadyCheck: !forBullMQ,
    retryStrategy(times: number) {
      return Math.min(times * 200, 5000);
    },
    reconnectOnError(err: Error) {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
      return targetErrors.some((msg) => err.message.includes(msg));
    },
  };
}

let sharedRedis: IORedis | null = null;

export function getRedisClient(): IORedis {
  if (!sharedRedis) {
    sharedRedis = new IORedis(buildRedisOptions(false));
    sharedRedis.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });
    sharedRedis.on('connect', () => {
      console.log('[Redis] Connected to', `${env.REDIS_HOST}:${env.REDIS_PORT}`);
    });
  }
  return sharedRedis;
}

export function createBullMQConnection(): IORedis {
  const conn = new IORedis(buildRedisOptions(true));
  conn.on('error', (err) => {
    console.error('[BullMQ Redis] Connection error:', err.message);
  });
  return conn;
}

export async function closeRedis(): Promise<void> {
  if (sharedRedis) {
    await sharedRedis.quit();
    sharedRedis = null;
  }
}
