import bcrypt from 'bcryptjs';
import { adminEmailSet } from '../config/env';
import { prisma } from '../config/prisma';
import { VerifiedGoogleProfile } from '../integrations/google/googleAuth';
import { ConflictError, UnauthorizedError } from '../utils/errors';

async function ensureDefaultSender(userId: string, email: string, name: string) {
  const existing = await prisma.sender.findFirst({ where: { userId } });
  if (!existing) {
    await prisma.sender.create({
      data: {
        userId,
        email: email.toLowerCase(),
        displayName: name,
        isDefault: true,
      },
    });
  }
}

export async function findOrCreateGoogleUser(profile: VerifiedGoogleProfile) {
  const normalizedEmail = profile.email.toLowerCase();
  const isAdmin = adminEmailSet.has(normalizedEmail);

  let user = await prisma.user.findFirst({
    where: {
      OR: [{ googleId: profile.googleId }, { email: normalizedEmail }],
    },
  });

  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        googleId: profile.googleId,
        name: user.name || profile.name,
        avatar: profile.avatar || user.avatar,
        ...(isAdmin ? { role: 'ADMIN' } : {}),
      },
    });
  } else {
    user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: profile.name,
        googleId: profile.googleId,
        avatar: profile.avatar,
        role: isAdmin ? 'ADMIN' : 'USER',
      },
    });
  }

  await ensureDefaultSender(user.id, user.email, user.name);
  return user;
}

export async function registerUserWithPassword(input: {
  name: string;
  email: string;
  password: string;
}) {
  const normalizedEmail = input.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    throw new ConflictError('An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const isAdmin = adminEmailSet.has(normalizedEmail);

  const user = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: isAdmin ? 'ADMIN' : 'USER',
    },
  });

  await ensureDefaultSender(user.id, user.email, user.name);
  return user;
}

export async function loginUserWithPassword(input: { email: string; password: string }) {
  const normalizedEmail = input.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user || !user.passwordHash) {
    throw new UnauthorizedError('Invalid email or password.');
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError('Invalid email or password.');
  }

  await ensureDefaultSender(user.id, user.email, user.name);
  return user;
}
