import { Queue } from 'bullmq';
import { createBullMQConnection } from '../config/redis';
import { EmailJobData } from '../types';

export const EMAIL_QUEUE_NAME = 'email-send-queue';
export const ES_INDEX_QUEUE_NAME = 'email-index-queue';

let emailQueueInstance: Queue<EmailJobData> | null = null;
let esIndexQueueInstance: Queue<{ emailId: string }> | null = null;

export function getEmailQueue(): Queue<EmailJobData> {
  if (!emailQueueInstance) {
    emailQueueInstance = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
      connection: createBullMQConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 7 * 24 * 3600,
          count: 5000,
        },
        removeOnFail: false,
      },
    });
  }
  return emailQueueInstance;
}

export function getEsIndexQueue(): Queue<{ emailId: string }> {
  if (!esIndexQueueInstance) {
    esIndexQueueInstance = new Queue<{ emailId: string }>(ES_INDEX_QUEUE_NAME, {
      connection: createBullMQConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        removeOnComplete: true,
        removeOnFail: { age: 24 * 3600 },
      },
    });
  }
  return esIndexQueueInstance;
}

export async function enqueueEmailJob(data: EmailJobData, scheduledAt: Date): Promise<string> {
  const queue = getEmailQueue();
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());
  const job = await queue.add('send-email', data, {
    jobId: data.emailId,
    delay,
  });
  return job.id || data.emailId;
}

export async function enqueueEmailJobsBulk(
  items: Array<{ data: EmailJobData; scheduledAt: Date }>
): Promise<void> {
  if (items.length === 0) return;
  const queue = getEmailQueue();
  const now = Date.now();
  const chunkSize = 500;

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize).map((item) => ({
      name: 'send-email',
      data: item.data,
      opts: {
        jobId: item.data.emailId,
        delay: Math.max(0, item.scheduledAt.getTime() - now),
      },
    }));
    await queue.addBulk(chunk);
  }
}

export async function enqueueEsIndexBulk(emailIds: string[]): Promise<void> {
  if (emailIds.length === 0) return;
  try {
    const queue = getEsIndexQueue();
    const chunkSize = 500;
    for (let i = 0; i < emailIds.length; i += chunkSize) {
      const chunk = emailIds.slice(i, i + chunkSize).map((emailId) => ({
        name: 'index-email',
        data: { emailId },
        opts: { jobId: `es-${emailId}`, delay: 500 },
      }));
      await queue.addBulk(chunk);
    }
  } catch (err) {
    console.warn('[Queue] Failed to enqueue ES bulk indexing:', (err as Error).message);
  }
}

export async function removeEmailJob(jobId: string): Promise<void> {
  const queue = getEmailQueue();
  const job = await queue.getJob(jobId);
  if (job) {
    const state = await job.getState();
    if (state === 'delayed' || state === 'waiting' || state === 'prioritized') {
      await job.remove();
    }
  }
}

export async function enqueueEsIndexRetry(emailId: string): Promise<void> {
  try {
    const queue = getEsIndexQueue();
    await queue.add('index-email', { emailId }, { jobId: `es-${emailId}`, delay: 2000 });
  } catch (err) {
    console.warn('[Queue] Failed to enqueue ES retry:', (err as Error).message);
  }
}

export async function closeQueues(): Promise<void> {
  if (emailQueueInstance) {
    await emailQueueInstance.close();
    emailQueueInstance = null;
  }
  if (esIndexQueueInstance) {
    await esIndexQueueInstance.close();
    esIndexQueueInstance = null;
  }
}
