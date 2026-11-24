import crypto from 'crypto';
import { EmailStatus, Prisma } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import {
  indexEmailDocument,
  searchEmailsInElasticsearch,
  updateEmailIndexStatus,
} from '../integrations/elasticsearch/emailSearch';
import {
  enqueueEmailJobsBulk,
  enqueueEsIndexBulk,
  enqueueEsIndexRetry,
  removeEmailJob,
} from '../queues/emailQueue';
import { EmailAttachmentPayload } from '../types';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import { htmlToPlainText } from '../utils/html';

export interface ScheduleEmailsInput {
  senderId: string;
  recipients: string[];
  subject: string;
  body: string;
  scheduledAt: string;
  delayBetweenEmailsSeconds?: number;
  hourlyLimit?: number;
  attachments?: EmailAttachmentPayload[];
  requestIdempotencyKey?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseCsvOrTextEmails(content: string): {
  validEmails: string[];
  invalidEmails: string[];
  totalProcessed: number;
} {
  const tokens = content
    .split(/[\r\n,;|\t]+/)
    .map((t) => t.trim().replace(/^["']|["']$/g, '').toLowerCase())
    .filter(Boolean);

  const validSet = new Set<string>();
  const invalidList: string[] = [];

  for (const token of tokens) {
    // Skip common CSV header labels
    if (token === 'email' || token === 'emails' || token === 'recipient' || token === 'address') {
      continue;
    }
    if (EMAIL_REGEX.test(token)) {
      validSet.add(token);
    } else {
      invalidList.push(token);
    }
  }

  return {
    validEmails: Array.from(validSet),
    invalidEmails: invalidList,
    totalProcessed: validSet.size + invalidList.length,
  };
}

export async function scheduleEmails(userId: string, input: ScheduleEmailsInput) {
  const sender = await prisma.sender.findUnique({ where: { id: input.senderId } });
  if (!sender) {
    throw new NotFoundError('Selected sender account does not exist.');
  }
  if (sender.userId !== userId) {
    throw new ForbiddenError('You cannot send from a sender account you do not own.');
  }

  const startDate = new Date(input.scheduledAt);
  if (Number.isNaN(startDate.getTime())) {
    throw new BadRequestError('Invalid scheduled start date/time.');
  }

  const uniqueRecipients = Array.from(
    new Set(
      input.recipients
        .map((r) => r.trim().toLowerCase())
        .filter((r) => EMAIL_REGEX.test(r))
    )
  );

  if (uniqueRecipients.length === 0) {
    throw new BadRequestError('At least one valid recipient email address is required.');
  }

  const delayMs =
    input.delayBetweenEmailsSeconds !== undefined && input.delayBetweenEmailsSeconds > 0
      ? input.delayBetweenEmailsSeconds * 1000
      : env.MIN_DELAY_BETWEEN_EMAILS;

  const effectiveHourlyLimit =
    input.hourlyLimit !== undefined && input.hourlyLimit > 0
      ? input.hourlyLimit
      : env.MAX_EMAILS_PER_HOUR_PER_SENDER;

  const plainText = htmlToPlainText(input.body);
  const requestNonce = input.requestIdempotencyKey || crypto.randomUUID();

  const recordsToCreate = uniqueRecipients.map((recipient, idx) => {
    const recipientScheduledAt = new Date(startDate.getTime() + idx * delayMs);
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(`${userId}:${sender.id}:${recipient}:${input.subject}:${requestNonce}`)
      .digest('hex');
    const id = crypto.randomUUID();

    return {
      id,
      userId,
      senderId: sender.id,
      recipient,
      subject: input.subject.trim(),
      body: input.body,
      textBody: plainText,
      attachments:
        input.attachments && input.attachments.length > 0
          ? (input.attachments as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      scheduledAt: recipientScheduledAt,
      status: EmailStatus.SCHEDULED,
      delayBetweenEmailsMs: delayMs,
      hourlyLimit: effectiveHourlyLimit,
      idempotencyKey,
      bullJobId: id,
    };
  });

  const allKeys = recordsToCreate.map((r) => r.idempotencyKey);

  // Check if idempotencyKeys already exist (e.g., duplicate client retry)
  const existing = await prisma.email.findMany({
    where: {
      idempotencyKey: { in: allKeys },
    },
    include: { sender: true },
  });

  if (existing.length === recordsToCreate.length) {
    return {
      scheduledCount: existing.length,
      emails: existing,
      deduplicated: true,
    };
  }

  const existingKeys = new Set(existing.map((e) => e.idempotencyKey));
  const freshRecords = recordsToCreate.filter((r) => !existingKeys.has(r.idempotencyKey));

  // Batch insert in chunks so 1000+ email campaigns commit rapidly in a single transaction
  const insertChunkSize = 500;
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < freshRecords.length; i += insertChunkSize) {
      await tx.email.createMany({
        data: freshRecords.slice(i, i + insertChunkSize),
        skipDuplicates: true,
      });
    }
  });

  const createdEmails = await prisma.email.findMany({
    where: {
      idempotencyKey: { in: freshRecords.map((r) => r.idempotencyKey) },
    },
    include: { sender: true },
    orderBy: { scheduledAt: 'asc' },
  });

  // Bulk enqueue persistent BullMQ delayed jobs using Redis pipelining
  await enqueueEmailJobsBulk(
    createdEmails.map((email) => ({
      data: {
        emailId: email.id,
        userId: email.userId,
        senderId: email.senderId,
        idempotencyKey: email.idempotencyKey,
      },
      scheduledAt: email.scheduledAt,
    }))
  );

  // Index inline for small batches; offload large 25+ batches to ES worker queue
  if (createdEmails.length <= 25) {
    await Promise.all(
      createdEmails.map(async (email) => {
        const indexed = await indexEmailDocument({
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
          sentAt: null,
          createdAt: email.createdAt.toISOString(),
        });
        if (!indexed) {
          await enqueueEsIndexRetry(email.id);
        }
      })
    );
  } else {
    await enqueueEsIndexBulk(createdEmails.map((e) => e.id));
  }

  const allEmails = [...existing, ...createdEmails];
  return {
    scheduledCount: allEmails.length,
    emails: allEmails,
    deduplicated: existing.length > 0,
  };
}

export interface ListEmailsFilters {
  status?: EmailStatus | EmailStatus[];
  search?: string;
  senderId?: string;
  sortBy?: 'scheduledAt' | 'sentAt' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export async function listUserEmails(userId: string, filters: ListEmailsFilters) {
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(100, Math.max(1, filters.limit || 25));
  const skip = (page - 1) * limit;

  const where: Prisma.EmailWhereInput = {
    userId,
  };

  if (filters.status) {
    where.status = Array.isArray(filters.status)
      ? { in: filters.status }
      : filters.status;
  }

  if (filters.senderId) {
    where.senderId = filters.senderId;
  }

  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { recipient: { contains: q } },
      { subject: { contains: q } },
      { textBody: { contains: q } },
      { sender: { email: { contains: q } } },
    ];
  }

  const sortField = filters.sortBy || 'scheduledAt';
  const sortOrder = filters.sortOrder || 'desc';

  const [items, total] = await Promise.all([
    prisma.email.findMany({
      where,
      include: {
        sender: {
          select: { id: true, email: true, displayName: true },
        },
      },
      orderBy: { [sortField]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.email.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getUserEmailById(userId: string, emailId: string) {
  const email = await prisma.email.findUnique({
    where: { id: emailId },
    include: {
      sender: {
        select: { id: true, email: true, displayName: true },
      },
    },
  });

  if (!email) {
    throw new NotFoundError('Email not found.');
  }
  if (email.userId !== userId) {
    throw new ForbiddenError();
  }
  return email;
}

export async function toggleUserEmailStar(userId: string, emailId: string) {
  const email = await getUserEmailById(userId, emailId);
  return prisma.email.update({
    where: { id: email.id },
    data: { starred: !email.starred },
    include: {
      sender: { select: { id: true, email: true, displayName: true } },
    },
  });
}

export async function cancelOrDeleteEmail(userId: string, emailId: string) {
  const email = await getUserEmailById(userId, emailId);

  if (email.status === EmailStatus.SCHEDULED) {
    await removeEmailJob(email.bullJobId || email.id);
    const updated = await prisma.email.update({
      where: { id: email.id },
      data: { status: EmailStatus.CANCELLED },
    });
    const indexed = await updateEmailIndexStatus(email.id, EmailStatus.CANCELLED, null);
    if (!indexed) {
      await enqueueEsIndexRetry(email.id);
    }
    return { action: 'cancelled', email: updated };
  }

  await prisma.email.delete({ where: { id: email.id } });
  return { action: 'deleted', emailId: email.id };
}

export async function getUserDashboardStats(userId: string) {
  const grouped = await prisma.email.groupBy({
    by: ['status'],
    where: { userId },
    _count: { _all: true },
  });

  const counts: Record<EmailStatus, number> = {
    SCHEDULED: 0,
    PROCESSING: 0,
    SENT: 0,
    FAILED: 0,
    CANCELLED: 0,
  };

  for (const row of grouped) {
    counts[row.status] = row._count._all;
  }

  const total =
    counts.SCHEDULED + counts.PROCESSING + counts.SENT + counts.FAILED + counts.CANCELLED;

  return {
    total,
    scheduled: counts.SCHEDULED + counts.PROCESSING,
    sent: counts.SENT,
    failed: counts.FAILED,
    cancelled: counts.CANCELLED,
    sentAndFailed: counts.SENT + counts.FAILED,
  };
}

export async function searchUserEmails(
  userId: string,
  params: {
    q?: string;
    status?: EmailStatus;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }
) {
  try {
    const esResult = await searchEmailsInElasticsearch({
      userId,
      query: params.q,
      status: params.status,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      page: params.page,
      limit: params.limit,
    });

    if (esResult.ids.length === 0) {
      return {
        items: [],
        total: esResult.total,
        page: esResult.page,
        limit: esResult.limit,
        totalPages: Math.max(1, Math.ceil(esResult.total / esResult.limit)),
        engine: 'elasticsearch' as const,
      };
    }

    const dbRecords = await prisma.email.findMany({
      where: {
        id: { in: esResult.ids },
        userId,
      },
      include: {
        sender: { select: { id: true, email: true, displayName: true } },
      },
    });

    const mapById = new Map(dbRecords.map((r) => [r.id, r]));
    const ordered = esResult.ids
      .map((id) => mapById.get(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    return {
      items: ordered,
      total: esResult.total,
      page: esResult.page,
      limit: esResult.limit,
      totalPages: Math.max(1, Math.ceil(esResult.total / esResult.limit)),
      engine: 'elasticsearch' as const,
    };
  } catch {
    // Graceful fallback to PostgreSQL if Elasticsearch is offline
    const where: Prisma.EmailWhereInput = { userId };
    if (params.status) {
      where.status = params.status;
    }
    if (params.dateFrom || params.dateTo) {
      where.scheduledAt = {
        ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
        ...(params.dateTo ? { lte: new Date(params.dateTo) } : {}),
      };
    }
    if (params.q && params.q.trim()) {
      const q = params.q.trim();
      where.OR = [
        { recipient: { contains: q } },
        { subject: { contains: q } },
        { textBody: { contains: q } },
        { sender: { email: { contains: q } } },
      ];
    }

    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const [items, total] = await Promise.all([
      prisma.email.findMany({
        where,
        include: { sender: { select: { id: true, email: true, displayName: true } } },
        orderBy: { scheduledAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.email.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      engine: 'postgresql-fallback' as const,
    };
  }
}
