import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { getRedisClient } from '../config/redis';
import { getElasticsearchClient } from '../integrations/elasticsearch/emailSearch';

export async function handleHealthCheck(_req: Request, res: Response): Promise<void> {
  const checks: Record<string, 'ok' | 'degraded' | 'down'> = {
    postgres: 'down',
    redis: 'down',
    elasticsearch: 'degraded',
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.postgres = 'ok';
  } catch {
    checks.postgres = 'down';
  }

  try {
    const redis = getRedisClient();
    const pong = await redis.ping();
    checks.redis = pong === 'PONG' ? 'ok' : 'down';
  } catch {
    checks.redis = 'down';
  }

  try {
    const es = getElasticsearchClient();
    await es.ping();
    checks.elasticsearch = 'ok';
  } catch {
    checks.elasticsearch = 'degraded';
  }

  const healthy = checks.postgres === 'ok' && checks.redis === 'ok';
  res.status(healthy ? 200 : 503).json({
    success: healthy,
    status: healthy ? 'ok' : 'unhealthy',
    timestamp: new Date().toISOString(),
    services: checks,
  });
}
