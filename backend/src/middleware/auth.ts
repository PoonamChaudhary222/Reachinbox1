import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env, adminEmailSet } from '../config/env';
import { prisma } from '../config/prisma';
import { AuthUser } from '../types';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

export const SESSION_COOKIE_NAME = 'reachinbox_session';

interface SessionPayload {
  userId: string;
  email: string;
}

export function signSessionToken(user: { id: string; email: string }): string {
  return jwt.sign({ userId: user.id, email: user.email }, env.SESSION_SECRET, {
    expiresIn: '7d',
  });
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    if (!token) {
      return next(new UnauthorizedError('Authentication required. Please log in.'));
    }

    const decoded = jwt.verify(token, env.SESSION_SECRET) as SessionPayload;
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
      },
    });

    if (!user) {
      return next(new UnauthorizedError('Session user no longer exists.'));
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      role: adminEmailSet.has(user.email.toLowerCase()) ? 'ADMIN' : user.role,
    };

    req.user = authUser;
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired session. Please log in again.'));
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(new UnauthorizedError());
  }
  if (req.user.role !== 'ADMIN' && !adminEmailSet.has(req.user.email.toLowerCase())) {
    return next(new ForbiddenError('Admin authorization required for queue dashboard.'));
  }
  next();
}
