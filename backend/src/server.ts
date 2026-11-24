import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { closeRedis, getRedisClient } from './config/redis';
import { ensureEmailIndex } from './integrations/elasticsearch/emailSearch';
import { closeQueues } from './queues/emailQueue';

async function bootstrap() {
  const app = createApp();

  // Warm up Redis and Elasticsearch index (non-fatal if ES isn't up yet)
  getRedisClient();
  ensureEmailIndex().catch(() => {});

  const server = app.listen(env.PORT, () => {
    console.log(`[Server] ReachInbox API listening on http://localhost:${env.PORT}`);
    console.log(`[Server] Bull Board available at http://localhost:${env.PORT}/admin/queues`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[Server] Received ${signal}. Closing HTTP server...`);
    server.close(async () => {
      await closeQueues();
      await closeRedis();
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});
