import { DelayedError, Job } from 'bullmq';
import { EmailStatus } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { sendViaSmtp } from '../integrations/email/etherealMailer';
import { updateEmailIndexStatus } from '../integrations/elasticsearch/emailSearch';
import { sendSlackRateLimitAlert } from '../integrations/slack/slackService';
import { enqueueEsIndexRetry } from '../queues/emailQueue';
import {
  acquirePerSenderSendSlot,
  claimSlackRateLimitNotification,
  consumeSenderHourlyQuota,
  reserveNextWindowTimestamp,
} from '../services/rateLimitService';
import { EmailAttachmentPayload, EmailJobData } from '../types';

export async function processEmailJob(job: Job<EmailJobData>, token?: string): Promise<void> {
  const { emailId } = job.data;

  const email = await prisma.email.findUnique({
    where: { id: emailId },
    include: { sender: true },
  });

  if (!email) {
    console.warn(`[Worker] Email ${emailId} not found in DB; skipping.`);
    return;
  }

  if (email.status === EmailStatus.SENT || email.status === EmailStatus.CANCELLED) {
    console.log(`[Worker] Email ${emailId} already ${email.status}; skipping duplicate send.`);
    return;
  }

  if (email.status === EmailStatus.PROCESSING) {
    console.warn(
      `[Worker] Email ${emailId} is already in PROCESSING state; skipping to prevent duplicate SMTP send.`
    );
    return;
  }

  const effectiveDelayMs = Math.max(
    env.MIN_DELAY_BETWEEN_EMAILS,
    email.delayBetweenEmailsMs || 0
  );
  const effectiveHourlyLimit = Math.max(
    1,
    email.hourlyLimit || env.MAX_EMAILS_PER_HOUR_PER_SENDER
  );

  // 1. Enforce minimum per-sender delay across all worker instances
  const slot = await acquirePerSenderSendSlot(email.senderId, effectiveDelayMs);
  if (!slot.acquired) {
    const jitterMs = Math.floor(Math.random() * 120) + 25;
    const targetMs = Math.max(Date.now() + 150, slot.nextAllowedAtMs + jitterMs);
    await job.moveToDelayed(targetMs, token);
    throw new DelayedError('Per-sender minimum delay active; deferred to next send slot.');
  }

  // 2. Enforce distributed per-sender hourly rate limit
  const quota = await consumeSenderHourlyQuota(email.senderId, effectiveHourlyLimit);
  if (!quota.allowed) {
    const nextSendAt = await reserveNextWindowTimestamp(
      email.senderId,
      quota.nextWindowAt,
      effectiveDelayMs
    );

    await prisma.email.update({
      where: { id: email.id },
      data: { scheduledAt: nextSendAt },
    });

    const shouldNotify = await claimSlackRateLimitNotification(email.senderId, quota.windowKey);
    if (shouldNotify) {
      const delayedCount = await prisma.email.count({
        where: { senderId: email.senderId, status: EmailStatus.SCHEDULED },
      });
      await sendSlackRateLimitAlert({
        userId: email.userId,
        senderEmail: email.sender.email,
        hourlyLimit: effectiveHourlyLimit,
        limitReachedAt: new Date(),
        delayedCount,
        nextWindowAt: quota.nextWindowAt,
      }).catch((err) => {
        console.warn('[Worker] Slack notification failed:', (err as Error).message);
      });
    }

    await job.moveToDelayed(nextSendAt.getTime(), token);
    throw new DelayedError(
      `Hourly rate limit (${effectiveHourlyLimit}/hr) reached for ${email.sender.email}; rescheduled to ${nextSendAt.toISOString()}.`
    );
  }

  // 3. Atomic DB state transition: SCHEDULED -> PROCESSING
  const claim = await prisma.email.updateMany({
    where: {
      id: email.id,
      status: EmailStatus.SCHEDULED,
    },
    data: {
      status: EmailStatus.PROCESSING,
    },
  });

  if (claim.count === 0) {
    console.log(`[Worker] Email ${emailId} could not be claimed (concurrent update or cancelled).`);
    return;
  }

  // 4. Send email via Ethereal / configured SMTP
  try {
    const attachments = Array.isArray(email.attachments)
      ? (email.attachments as unknown as EmailAttachmentPayload[])
      : [];

    const result = await sendViaSmtp({
      fromEmail: email.sender.email,
      fromName: email.sender.displayName,
      to: email.recipient,
      subject: email.subject,
      html: email.body,
      text: email.textBody,
      attachments,
      smtpConfig: {
        host: email.sender.smtpHost,
        port: email.sender.smtpPort,
        user: email.sender.smtpUser,
        encryptedPass: email.sender.encryptedSmtpPass,
      },
    });

    const sentAt = new Date();
    await prisma.email.update({
      where: { id: email.id },
      data: {
        status: EmailStatus.SENT,
        sentAt,
        etherealPreviewUrl: result.previewUrl,
        errorMessage: null,
      },
    });

    const indexed = await updateEmailIndexStatus(email.id, EmailStatus.SENT, sentAt);
    if (!indexed) {
      await enqueueEsIndexRetry(email.id);
    }

    console.log(
      `[Worker] Sent email ${email.id} to ${email.recipient}` +
        (result.previewUrl ? ` | Preview: ${result.previewUrl}` : '')
    );
  } catch (err) {
    const message = (err as Error).message || 'SMTP send failed';
    const maxAttempts = job.opts.attempts || 5;
    const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;

    if (isFinalAttempt) {
      await prisma.email.update({
        where: { id: email.id },
        data: {
          status: EmailStatus.FAILED,
          errorMessage: message,
          retryCount: { increment: 1 },
        },
      });
      const indexed = await updateEmailIndexStatus(email.id, EmailStatus.FAILED, null);
      if (!indexed) {
        await enqueueEsIndexRetry(email.id);
      }
    } else {
      // Revert to SCHEDULED so BullMQ backoff retry can re-claim atomically
      await prisma.email.update({
        where: { id: email.id },
        data: {
          status: EmailStatus.SCHEDULED,
          errorMessage: message,
          retryCount: { increment: 1 },
        },
      });
    }

    throw err;
  }
}
