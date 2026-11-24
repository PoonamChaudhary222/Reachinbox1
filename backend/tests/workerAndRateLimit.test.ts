import { EmailStatus } from '@prisma/client';
import { DelayedError, Job } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailJobData } from '../src/types';

const {
  prismaMock,
  sendViaSmtpMock,
  sendSlackAlertMock,
  acquireSlotMock,
  consumeQuotaMock,
  reserveNextWindowMock,
  claimSlackNotifMock,
} = vi.hoisted(() => ({
  prismaMock: {
    email: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
  sendViaSmtpMock: vi.fn(),
  sendSlackAlertMock: vi.fn().mockResolvedValue(true),
  acquireSlotMock: vi.fn(),
  consumeQuotaMock: vi.fn(),
  reserveNextWindowMock: vi.fn(),
  claimSlackNotifMock: vi.fn(),
}));

vi.mock('../src/config/prisma', () => ({ prisma: prismaMock }));
vi.mock('../src/integrations/email/etherealMailer', () => ({
  sendViaSmtp: sendViaSmtpMock,
}));
vi.mock('../src/integrations/slack/slackService', () => ({
  sendSlackRateLimitAlert: sendSlackAlertMock,
}));
vi.mock('../src/integrations/elasticsearch/emailSearch', () => ({
  updateEmailIndexStatus: vi.fn().mockResolvedValue(true),
}));
vi.mock('../src/queues/emailQueue', () => ({
  enqueueEsIndexRetry: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../src/services/rateLimitService', () => ({
  acquirePerSenderSendSlot: acquireSlotMock,
  consumeSenderHourlyQuota: consumeQuotaMock,
  reserveNextWindowTimestamp: reserveNextWindowMock,
  claimSlackRateLimitNotification: claimSlackNotifMock,
}));

import { processEmailJob } from '../src/workers/emailProcessor';

function createMockJob(overrides: Partial<Job<EmailJobData>> = {}): Job<EmailJobData> {
  return {
    id: 'email-1',
    data: {
      emailId: 'email-1',
      userId: 'user-1',
      senderId: 'sender-1',
      idempotencyKey: 'idem-1',
    },
    attemptsMade: 0,
    opts: { attempts: 5 },
    moveToDelayed: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as Job<EmailJobData>;
}

const baseEmail = {
  id: 'email-1',
  userId: 'user-1',
  senderId: 'sender-1',
  recipient: 'target@example.com',
  subject: 'Hello',
  body: '<p>Test</p>',
  textBody: 'Test',
  attachments: null,
  scheduledAt: new Date(),
  status: EmailStatus.SCHEDULED,
  delayBetweenEmailsMs: 2000,
  hourlyLimit: 10,
  sender: {
    id: 'sender-1',
    email: 'sender@domain.io',
    displayName: 'Sender',
    smtpHost: null,
    smtpPort: null,
    smtpUser: null,
    encryptedSmtpPass: null,
  },
};

describe('BullMQ Worker: Idempotency, Delay Enforcement, Rate Limiting & Slack Alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends via Ethereal SMTP and transitions SCHEDULED -> PROCESSING -> SENT', async () => {
    prismaMock.email.findUnique.mockResolvedValue(baseEmail);
    acquireSlotMock.mockResolvedValue({ acquired: true, nextAllowedAtMs: 0 });
    consumeQuotaMock.mockResolvedValue({
      allowed: true,
      currentCount: 1,
      windowKey: '2026112500',
      nextWindowAt: new Date(Date.now() + 3600000),
    });
    prismaMock.email.updateMany.mockResolvedValue({ count: 1 });
    sendViaSmtpMock.mockResolvedValue({
      messageId: '<msg-1@ethereal>',
      previewUrl: 'https://ethereal.email/message/1',
    });

    await processEmailJob(createMockJob(), 'token-1');

    expect(sendViaSmtpMock).toHaveBeenCalledTimes(1);
    expect(prismaMock.email.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'email-1' },
        data: expect.objectContaining({
          status: EmailStatus.SENT,
          etherealPreviewUrl: 'https://ethereal.email/message/1',
        }),
      })
    );
  });

  it('prevents duplicate sending if email is already SENT or CANCELLED', async () => {
    prismaMock.email.findUnique.mockResolvedValue({
      ...baseEmail,
      status: EmailStatus.SENT,
    });

    await processEmailJob(createMockJob(), 'token-1');
    expect(sendViaSmtpMock).not.toHaveBeenCalled();
    expect(prismaMock.email.updateMany).not.toHaveBeenCalled();
  });

  it('enforces per-sender minimum delay by moving job to delayed without failing', async () => {
    const job = createMockJob();
    prismaMock.email.findUnique.mockResolvedValue(baseEmail);
    acquireSlotMock.mockResolvedValue({
      acquired: false,
      nextAllowedAtMs: Date.now() + 2000,
    });

    await expect(processEmailJob(job, 'token-1')).rejects.toThrow(DelayedError);
    expect(job.moveToDelayed).toHaveBeenCalledTimes(1);
    expect(sendViaSmtpMock).not.toHaveBeenCalled();
  });

  it('reschedules pending jobs to next hour window and sends deduplicated Slack alert on hourly limit', async () => {
    const job = createMockJob();
    const nextWindow = new Date(Date.now() + 1800 * 1000);

    prismaMock.email.findUnique.mockResolvedValue(baseEmail);
    acquireSlotMock.mockResolvedValue({ acquired: true, nextAllowedAtMs: 0 });
    consumeQuotaMock.mockResolvedValue({
      allowed: false,
      currentCount: 10,
      windowKey: '2026112500',
      nextWindowAt: nextWindow,
    });
    reserveNextWindowMock.mockResolvedValue(nextWindow);
    claimSlackNotifMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    prismaMock.email.count.mockResolvedValue(42);

    await expect(processEmailJob(job, 'token-1')).rejects.toThrow(DelayedError);
    expect(job.moveToDelayed).toHaveBeenCalledWith(nextWindow.getTime(), 'token-1');
    expect(sendSlackAlertMock).toHaveBeenCalledTimes(1);
    expect(sendSlackAlertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        senderEmail: 'sender@domain.io',
        hourlyLimit: 10,
        delayedCount: 42,
      })
    );

    const job2 = createMockJob({ id: 'email-2' });
    await expect(processEmailJob(job2, 'token-2')).rejects.toThrow(DelayedError);
    expect(sendSlackAlertMock).toHaveBeenCalledTimes(1);
  });

  it('supports independent quotas and slots across multiple senders', async () => {
    const sender2Email = {
      ...baseEmail,
      id: 'email-s2',
      senderId: 'sender-2',
      sender: { ...baseEmail.sender, id: 'sender-2', email: 'second@domain.io' },
    };

    prismaMock.email.findUnique.mockResolvedValue(sender2Email);
    acquireSlotMock.mockResolvedValue({ acquired: true, nextAllowedAtMs: 0 });
    consumeQuotaMock.mockResolvedValue({
      allowed: true,
      currentCount: 1,
      windowKey: '2026112500',
      nextWindowAt: new Date(Date.now() + 3600000),
    });
    prismaMock.email.updateMany.mockResolvedValue({ count: 1 });
    sendViaSmtpMock.mockResolvedValue({ messageId: '<s2@ethereal>', previewUrl: null });

    await processEmailJob(
      createMockJob({
        id: 'email-s2',
        data: {
          emailId: 'email-s2',
          userId: 'user-1',
          senderId: 'sender-2',
          idempotencyKey: 'idem-s2',
        },
      }),
      'token-s2'
    );

    expect(acquireSlotMock).toHaveBeenCalledWith('sender-2', 2000);
    expect(consumeQuotaMock).toHaveBeenCalledWith('sender-2', 10);
    expect(sendViaSmtpMock).toHaveBeenCalledTimes(1);
  });
});
