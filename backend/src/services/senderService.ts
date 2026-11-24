import { prisma } from '../config/prisma';
import { encryptSecret } from '../utils/crypto';
import { ConflictError, ForbiddenError, NotFoundError } from '../utils/errors';

export interface CreateSenderInput {
  email: string;
  displayName: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  isDefault?: boolean;
}

export async function listUserSenders(userId: string) {
  return prisma.sender.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      email: true,
      displayName: true,
      smtpHost: true,
      smtpPort: true,
      smtpUser: true,
      isDefault: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function createUserSender(userId: string, input: CreateSenderInput) {
  const normalizedEmail = input.email.toLowerCase().trim();

  const existing = await prisma.sender.findUnique({
    where: { userId_email: { userId, email: normalizedEmail } },
  });
  if (existing) {
    throw new ConflictError(`Sender ${normalizedEmail} already exists on your account.`);
  }

  const encryptedSmtpPass = input.smtpPass ? encryptSecret(input.smtpPass) : null;

  return prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.sender.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const senderCount = await tx.sender.count({ where: { userId } });

    return tx.sender.create({
      data: {
        userId,
        email: normalizedEmail,
        displayName: input.displayName.trim(),
        smtpHost: input.smtpHost?.trim() || null,
        smtpPort: input.smtpPort ?? null,
        smtpUser: input.smtpUser?.trim() || null,
        encryptedSmtpPass,
        isDefault: input.isDefault ?? senderCount === 0,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });
}

export async function updateUserSender(
  userId: string,
  senderId: string,
  input: Partial<CreateSenderInput>
) {
  const sender = await prisma.sender.findUnique({ where: { id: senderId } });
  if (!sender) {
    throw new NotFoundError('Sender not found.');
  }
  if (sender.userId !== userId) {
    throw new ForbiddenError();
  }

  return prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.sender.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    return tx.sender.update({
      where: { id: senderId },
      data: {
        ...(input.displayName ? { displayName: input.displayName.trim() } : {}),
        ...(input.smtpHost !== undefined ? { smtpHost: input.smtpHost.trim() || null } : {}),
        ...(input.smtpPort !== undefined ? { smtpPort: input.smtpPort || null } : {}),
        ...(input.smtpUser !== undefined ? { smtpUser: input.smtpUser.trim() || null } : {}),
        ...(input.smtpPass !== undefined
          ? { encryptedSmtpPass: input.smtpPass ? encryptSecret(input.smtpPass) : null }
          : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });
}

export async function deleteUserSender(userId: string, senderId: string) {
  const sender = await prisma.sender.findUnique({ where: { id: senderId } });
  if (!sender) {
    throw new NotFoundError('Sender not found.');
  }
  if (sender.userId !== userId) {
    throw new ForbiddenError();
  }

  await prisma.sender.delete({ where: { id: senderId } });
}
