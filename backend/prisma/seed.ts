import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { EmailStatus, PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log('[Seed] Seeding development visual data...');
  const passwordHash = await bcrypt.hash('DemoPass123!', 12);

  const user = await prisma.user.upsert({
    where: { email: 'oliver.brown@domain.io' },
    create: {
      name: 'Oliver Brown',
      email: 'oliver.brown@domain.io',
      passwordHash,
      role: UserRole.ADMIN,
    },
    update: {},
  });

  const sender = await prisma.sender.upsert({
    where: {
      userId_email: {
        userId: user.id,
        email: 'oliver.brown@domain.io',
      },
    },
    create: {
      userId: user.id,
      email: 'oliver.brown@domain.io',
      displayName: 'Oliver Brown',
      isDefault: true,
    },
    update: {},
  });

  const sampleEmails = [
    {
      recipient: 'john.smith@example.com',
      subject: 'Meeting follow-up - Scheduled',
      body: '<p>Hi John,</p><p>Just following up on our scheduled sync regarding the Q4 outreach rollout. Let me know if Tuesday works for a quick review.</p><p>Best,<br/>Oliver</p>',
      status: EmailStatus.SCHEDULED,
      scheduledAt: new Date(Date.now() + 24 * 3600 * 1000),
      sentAt: null,
    },
    {
      recipient: 'claire.vance@acme.io',
      subject: 'Outreach Campaign Intro - Product Walkthrough',
      body: '<p>Hey Claire,</p><p>Excited to share our latest email scheduler updates with your growth team.</p>',
      status: EmailStatus.SENT,
      scheduledAt: new Date(Date.now() - 3600 * 1000),
      sentAt: new Date(Date.now() - 3500 * 1000),
    },
  ];

  for (const item of sampleEmails) {
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(`seed:${user.id}:${item.recipient}:${item.subject}`)
      .digest('hex');

    await prisma.email.upsert({
      where: { idempotencyKey },
      create: {
        userId: user.id,
        senderId: sender.id,
        recipient: item.recipient,
        subject: item.subject,
        body: item.body,
        textBody: item.body.replace(/<[^>]+>/g, ' ').trim(),
        status: item.status,
        scheduledAt: item.scheduledAt,
        sentAt: item.sentAt,
        idempotencyKey,
      },
      update: {},
    });
  }

  console.log('[Seed] Done. Dev login: oliver.brown@domain.io / DemoPass123!');
}

seed()
  .catch((err) => {
    console.error('[Seed] Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
