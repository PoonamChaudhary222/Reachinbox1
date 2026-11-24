import { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import {
  exchangeGoogleCode,
  getGoogleAuthUrl,
  verifyGoogleIdToken,
} from '../integrations/google/googleAuth';
import {
  clearSessionCookie,
  setSessionCookie,
  signSessionToken,
} from '../middleware/auth';
import {
  findOrCreateGoogleUser,
  loginUserWithPassword,
  registerUserWithPassword,
} from '../services/authService';
import { generateRandomState } from '../utils/crypto';
import { BadRequestError, UnauthorizedError } from '../utils/errors';

const OAUTH_STATE_COOKIE = 'reachinbox_google_state';

export const googlePostSchema = z.object({
  idToken: z.string().min(10).optional(),
  code: z.string().min(4).optional(),
});

export const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function initiateGoogleOAuth(_req: Request, res: Response): Promise<void> {
  const state = generateRandomState();
  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/',
  });
  const url = getGoogleAuthUrl(state);
  res.redirect(url);
}

export async function handleGooglePost(req: Request, res: Response): Promise<void> {
  const { idToken, code } = req.body as z.infer<typeof googlePostSchema>;
  if (!idToken && !code) {
    throw new BadRequestError('Provide either idToken or code from Google OAuth.');
  }

  const profile = idToken
    ? await verifyGoogleIdToken(idToken)
    : await exchangeGoogleCode(code!);

  const user = await findOrCreateGoogleUser(profile);
  const token = signSessionToken({ id: user.id, email: user.email });
  setSessionCookie(res, token);

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
      },
    },
  });
}

export async function handleGoogleCallback(req: Request, res: Response): Promise<void> {
  const code = typeof req.query.code === 'string' ? req.query.code : undefined;
  const state = typeof req.query.state === 'string' ? req.query.state : undefined;
  const expectedState = req.cookies?.[OAUTH_STATE_COOKIE];

  res.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });

  if (!code || !state || !expectedState || state !== expectedState) {
    res.redirect(`${env.FRONTEND_URL}/login?error=invalid_oauth_state`);
    return;
  }

  try {
    const profile = await exchangeGoogleCode(code);
    const user = await findOrCreateGoogleUser(profile);
    const token = signSessionToken({ id: user.id, email: user.email });
    setSessionCookie(res, token);
    res.redirect(`${env.FRONTEND_URL}/`);
  } catch (err) {
    const message = encodeURIComponent((err as Error).message || 'Google authentication failed');
    res.redirect(`${env.FRONTEND_URL}/login?error=${message}`);
  }
}

export async function handleRegister(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof registerSchema>;
  const user = await registerUserWithPassword(body);
  const token = signSessionToken({ id: user.id, email: user.email });
  setSessionCookie(res, token);

  res.status(201).json({
    success: true,
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
      },
    },
  });
}

export async function handleLogin(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof loginSchema>;
  const user = await loginUserWithPassword(body);
  const token = signSessionToken({ id: user.id, email: user.email });
  setSessionCookie(res, token);

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
      },
    },
  });
}

export async function getCurrentUser(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  res.status(200).json({
    success: true,
    data: { user: req.user },
  });
}

export async function logout(_req: Request, res: Response): Promise<void> {
  clearSessionCookie(res);
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
}
