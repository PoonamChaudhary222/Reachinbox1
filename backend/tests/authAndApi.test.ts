import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailStatus } from '@prisma/client';

const mockUser = {
  id: 'user-1',
  email: 'oliver@reachinbox.ai',
  name: 'Oliver Brown',
  avatar: null,
  role: 'USER' as const,
};

const mockSender = {
  id: 'sender-1',
  userId: 'user-1',
  email: 'oliver@reachinbox.ai',
  displayName: 'Oliver Brown',
  smtpHost: null,
  smtpPort: null,
  smtpUser: null,
  encryptedSmtpPass: null,
  isDefault: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockEmailRecord = {
  id: 'email-1',
  userId: 'user-1',
  senderId: 'sender-1',
  recipient: 'lead@acme.com',
  subject: 'Q4 Demo',
  body: '<p>Hello!</p>',
  textBody: 'Hello!',
  attachments: null,
  scheduledAt: new Date(Date.now() + 60000),
  sentAt: null,
  status: EmailStatus.SCHEDULED,
  delayBetweenEmailsMs: 2000,
  hourlyLimit: 100,
  starred: false,
  errorMessage: null,
  etherealPreviewUrl: null,
  idempotencyKey: 'idem-1',
  bullJobId: 'email-1',
  retryCount: 0,
  esIndexed: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  sender: {
    id: 'sender-1',
    email: 'oliver@reachinbox.ai',
    displayName: 'Oliver Brown',
  },
};

const { prismaMock, enqueueMock, esSearchMock, googleVerifyMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    sender: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    email: {
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  enqueueMock: vi.fn().mockResolvedValue(undefined),
  esSearchMock: vi.fn(),
  googleVerifyMock: vi.fn(),
}));

vi.mock('../src/config/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('../src/queues/emailQueue', () => ({
  enqueueEmailJob: enqueueMock,
  enqueueEmailJobsBulk: enqueueMock,
  enqueueEsIndexBulk: vi.fn().mockResolvedValue(undefined),
  enqueueEsIndexRetry: vi.fn().mockResolvedValue(undefined),
  removeEmailJob: vi.fn().mockResolvedValue(undefined),
  getEmailQueue: vi.fn(),
  getEsIndexQueue: vi.fn(),
  closeQueues: vi.fn(),
}));

vi.mock('../src/integrations/google/googleAuth', () => ({
  verifyGoogleIdToken: googleVerifyMock,
  exchangeGoogleCode: vi.fn(),
  getGoogleAuthUrl: vi.fn(() => 'https://accounts.google.com/o/oauth2/v2/auth'),
}));

vi.mock('../src/integrations/elasticsearch/emailSearch', () => ({
  indexEmailDocument: vi.fn().mockResolvedValue(true),
  updateEmailIndexStatus: vi.fn().mockResolvedValue(true),
  searchEmailsInElasticsearch: esSearchMock,
  ensureEmailIndex: vi.fn().mockResolvedValue(true),
}));

import { createApp } from '../src/app';
import { signSessionToken } from '../src/middleware/auth';
import { parseCsvOrTextEmails } from '../src/services/emailService';

describe('Backend API: Auth, CSV Parsing, Schedule API & Search', () => {
  const app = createApp();
  const sessionToken = signSessionToken({ id: mockUser.id, email: mockUser.email });
  const authCookie = [`reachinbox_session=${sessionToken}`];

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue(mockUser);
  });

  it('verifies Google ID token, creates user, sets HTTP-only cookie, and authenticates /api/auth/me', async () => {
    googleVerifyMock.mockResolvedValue({
      googleId: 'g-123',
      email: mockUser.email,
      name: mockUser.name,
      avatar: null,
    });
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue(mockUser);
    prismaMock.sender.findFirst.mockResolvedValue(mockSender);

    const loginRes = await request(app)
      .post('/api/auth/google')
      .send({ idToken: 'valid-google-id-token-12345' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.user.email).toBe(mockUser.email);
    const setCookieHeader = loginRes.headers['set-cookie']?.[0] || '';
    expect(setCookieHeader).toContain('reachinbox_session=');
    expect(setCookieHeader.toLowerCase()).toContain('httponly');

    const meRes = await request(app).get('/api/auth/me').set('Cookie', authCookie);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe(mockUser.email);
  });

  it('rejects unauthenticated requests to protected routes', async () => {
    const res = await request(app).get('/api/emails');
    expect(res.status).toBe(401);
  });

  it('parses CSV/TXT email lists, removes duplicates, skips headers, and counts invalid emails', () => {
    const csv = `email\nAlice@example.com, bob@example.com\nALICE@example.com\ninvalid-email\ncharlie@acme.io;bad@`;
    const parsed = parseCsvOrTextEmails(csv);

    expect(parsed.validEmails).toEqual([
      'alice@example.com',
      'bob@example.com',
      'charlie@acme.io',
    ]);
    expect(parsed.invalidEmails).toEqual(['invalid-email', 'bad@']);
    expect(parsed.totalProcessed).toBe(5);
  });

  it('schedules emails in MySQL and bulk-enqueues BullMQ delayed jobs with stable IDs', async () => {
    prismaMock.sender.findUnique.mockResolvedValue(mockSender);
    prismaMock.email.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([mockEmailRecord]);
    prismaMock.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      return cb({
        email: {
          createMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      });
    });

    const res = await request(app)
      .post('/api/emails/schedule')
      .set('Cookie', authCookie)
      .send({
        senderId: 'sender-1',
        recipients: ['lead@acme.com'],
        subject: 'Q4 Demo',
        body: '<p>Hello!</p>',
        scheduledAt: new Date(Date.now() + 60000).toISOString(),
        delayBetweenEmailsSeconds: 2,
        hourlyLimit: 100,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.scheduledCount).toBe(1);
    expect(enqueueMock).toHaveBeenCalledTimes(1);
    expect(enqueueMock).toHaveBeenCalledWith([
      expect.objectContaining({
        data: expect.objectContaining({
          emailId: 'email-1',
          senderId: 'sender-1',
        }),
        scheduledAt: expect.any(Date),
      }),
    ]);
  });

  it('prevents duplicate scheduling when matching idempotencyKey already exists', async () => {
    prismaMock.sender.findUnique.mockResolvedValue(mockSender);
    prismaMock.email.findMany.mockResolvedValue([mockEmailRecord]);

    const res = await request(app)
      .post('/api/emails/schedule')
      .set('Cookie', authCookie)
      .send({
        senderId: 'sender-1',
        recipients: ['lead@acme.com'],
        subject: 'Q4 Demo',
        body: '<p>Hello!</p>',
        scheduledAt: new Date(Date.now() + 60000).toISOString(),
        requestIdempotencyKey: 'fixed-client-key-001',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.deduplicated).toBe(true);
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it('searches emails via Elasticsearch scoped to authenticated user', async () => {
    esSearchMock.mockResolvedValue({
      ids: ['email-1'],
      total: 1,
      page: 1,
      limit: 20,
    });
    prismaMock.email.findMany.mockResolvedValue([mockEmailRecord]);

    const res = await request(app)
      .get('/api/search/emails?q=acme&status=SCHEDULED')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.engine).toBe('elasticsearch');
    expect(res.body.data.items).toHaveLength(1);
    expect(esSearchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mockUser.id,
        query: 'acme',
        status: EmailStatus.SCHEDULED,
      })
    );
  });
});
