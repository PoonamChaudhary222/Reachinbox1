import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env';
import { BadRequestError, UnauthorizedError } from '../../utils/errors';

export interface VerifiedGoogleProfile {
  googleId: string;
  email: string;
  name: string;
  avatar: string | null;
}

function createGoogleClient(): OAuth2Client {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new BadRequestError(
      'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.'
    );
  }
  return new OAuth2Client(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET || undefined,
    env.GOOGLE_CALLBACK_URL
  );
}

export function getGoogleAuthUrl(state: string): string {
  const client = createGoogleClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    state,
    prompt: 'select_account',
  });
}

export async function verifyGoogleIdToken(idToken: string): Promise<VerifiedGoogleProfile> {
  const client = createGoogleClient();
  const ticket = await client.verifyIdToken({
    idToken,
    audience: env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email || !payload.email_verified) {
    throw new UnauthorizedError('Google ID token verification failed or email is unverified.');
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name || payload.email.split('@')[0],
    avatar: payload.picture || null,
  };
}

export async function exchangeGoogleCode(code: string): Promise<VerifiedGoogleProfile> {
  const client = createGoogleClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) {
    throw new UnauthorizedError('Google OAuth did not return an ID token.');
  }
  return verifyGoogleIdToken(tokens.id_token);
}
