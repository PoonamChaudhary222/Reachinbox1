import { Client } from '@elastic/elasticsearch';
import { EmailStatus } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { EmailSearchDocument } from '../../types';

export const EMAIL_INDEX = 'reachinbox_emails';

let esClient: Client | null = null;
let indexInitialized = false;

export function getElasticsearchClient(): Client {
  if (!esClient) {
    esClient = new Client({
      node: env.ELASTICSEARCH_URL,
      requestTimeout: 5000,
    });
  }
  return esClient;
}

export async function ensureEmailIndex(): Promise<boolean> {
  if (indexInitialized) return true;
  try {
    const client = getElasticsearchClient();
    const exists = await client.indices.exists({ index: EMAIL_INDEX });
    if (!exists) {
      await client.indices.create({
        index: EMAIL_INDEX,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            userId: { type: 'keyword' },
            senderId: { type: 'keyword' },
            senderEmail: { type: 'keyword' },
            senderName: { type: 'text' },
            recipient: {
              type: 'text',
              fields: { keyword: { type: 'keyword' } },
            },
            subject: {
              type: 'text',
              fields: { keyword: { type: 'keyword' } },
            },
            body: { type: 'text' },
            textBody: { type: 'text' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
            createdAt: { type: 'date' },
          },
        },
      });
    }
    indexInitialized = true;
    return true;
  } catch (err) {
    console.warn('[Elasticsearch] Unavailable during ensureEmailIndex:', (err as Error).message);
    return false;
  }
}

export async function indexEmailDocument(doc: EmailSearchDocument): Promise<boolean> {
  try {
    const ready = await ensureEmailIndex();
    if (!ready) return false;
    const client = getElasticsearchClient();
    await client.index({
      index: EMAIL_INDEX,
      id: doc.id,
      document: doc,
    });
    await prisma.email.update({
      where: { id: doc.id },
      data: { esIndexed: true },
    });
    return true;
  } catch (err) {
    console.warn('[Elasticsearch] Failed to index email', doc.id, (err as Error).message);
    return false;
  }
}

export async function updateEmailIndexStatus(
  emailId: string,
  status: EmailStatus,
  sentAt: Date | null
): Promise<boolean> {
  try {
    const ready = await ensureEmailIndex();
    if (!ready) return false;
    const client = getElasticsearchClient();
    await client.update({
      index: EMAIL_INDEX,
      id: emailId,
      doc: {
        status,
        sentAt: sentAt ? sentAt.toISOString() : null,
      },
      doc_as_upsert: false,
    });
    return true;
  } catch (err) {
    console.warn('[Elasticsearch] Failed to update status for', emailId, (err as Error).message);
    return false;
  }
}

export interface SearchEmailsParams {
  userId: string;
  query?: string;
  status?: EmailStatus;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export async function searchEmailsInElasticsearch(params: SearchEmailsParams) {
  const ready = await ensureEmailIndex();
  if (!ready) {
    throw new Error('Elasticsearch unavailable');
  }

  const client = getElasticsearchClient();
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const from = (page - 1) * limit;

  const filterClauses: Record<string, unknown>[] = [{ term: { userId: params.userId } }];

  if (params.status) {
    filterClauses.push({ term: { status: params.status } });
  }

  if (params.dateFrom || params.dateTo) {
    const range: Record<string, string> = {};
    if (params.dateFrom) range.gte = params.dateFrom;
    if (params.dateTo) range.lte = params.dateTo;
    filterClauses.push({ range: { scheduledAt: range } });
  }

  const mustClauses: Record<string, unknown>[] = [];
  if (params.query && params.query.trim()) {
    mustClauses.push({
      multi_match: {
        query: params.query.trim(),
        fields: ['recipient^3', 'subject^2', 'textBody', 'body', 'senderEmail'],
        fuzziness: 'AUTO',
      },
    });
  }

  const result = await client.search<EmailSearchDocument>({
    index: EMAIL_INDEX,
    from,
    size: limit,
    sort: [{ scheduledAt: { order: 'desc' } }],
    query: {
      bool: {
        must: mustClauses.length > 0 ? mustClauses : [{ match_all: {} }],
        filter: filterClauses,
      },
    },
  });

  const totalRaw = result.hits.total;
  const total = typeof totalRaw === 'number' ? totalRaw : totalRaw?.value ?? 0;
  const ids = result.hits.hits.map((hit) => hit._id).filter((id): id is string => Boolean(id));

  return { ids, total, page, limit };
}

export async function reconcileUnindexedEmails(batchSize = 50): Promise<number> {
  const unindexed = await prisma.email.findMany({
    where: { esIndexed: false },
    include: { sender: true },
    take: batchSize,
    orderBy: { createdAt: 'asc' },
  });

  let synced = 0;
  for (const email of unindexed) {
    const ok = await indexEmailDocument({
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
    if (ok) synced++;
  }
  return synced;
}
