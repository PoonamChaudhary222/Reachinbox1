import { Worker } from 'bullmq';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { closeRedis, createBullMQConnection } from './config/redis';
import {
  indexEmailDocument,
  reconcileUnindexedEmails,
} from './integrations/elasticsearch/emailSearch';
import {
  EMAIL_QUEUE_NAME,
  ES_INDEX_QUEUE_NAME,
  closeQueues,
} from './queues/emailQueue';
import { EmailJobData } from './types';
import { processEmailJob } from './workers/emailProcessor';

async function startWorker() {
  console.log(`[Worker] Starting BullMQ worker (concurrency=${env.WORKER_CONCURRENCY})...`);

  const emailWorker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job, token) => {
      await processEmailJob(job, token);
    },
    {
      connection: createBullMQConnection(),
      concurrency: env.WORKER_CONCURRENCY,
      lockDuration: 60000,
    }
  );

  emailWorker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed.`);
  });

  emailWorker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  emailWorker.on('error', (err) => {
    console.error('[Worker] Worker error:', err.message);
  });

  const esIndexWorker = new Worker<{ emailId: string }>(
    ES_INDEX_QUEUE_NAME,
    async (job) => {
      const email = await prisma.email.findUnique({
        where: { id: job.data.emailId },
        include: { sender: true },
      });
      if (!email) return;
      await indexEmailDocument({
        id: email.id,
        userId: email.userId,
        senderId: email.senderId,
        senderEmail: email.sender.email,
        senderName: email.sender.displayName,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
        textBody: email.textBody || '',
        status: email.status,
        scheduledAt: email.scheduledAt.toISOString(),
        sentAt: email.sentAt ? email.sentAt.toISOString() : null,
        createdAt: email.createdAt.toISOString(),
      });
    },
    {
      connection: createBullMQConnection(),
      concurrency: 3,
    }
  );

  esIndexWorker.on('error', (err) => {
    console.warn('[ES Worker] Error:', err.message);
  });

  // Reconcile any unindexed emails at startup
  reconcileUnindexedEmails(50).catch(() => {});

  const shutdown = async (signal: string) => {
    console.log(`[Worker] Received ${signal}. Shutting down gracefully...`);
    await emailWorker.close();
    await esIndexWorker.close();
    await closeQueues();
    await closeRedis();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startWorker().catch((err) => {
  console.error('[Worker] Fatal startup error:', err);
  process.exit(1);
});
