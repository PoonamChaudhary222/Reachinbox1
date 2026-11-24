import { Request, Response } from 'express';
import { env } from '../config/env';
import {
  disconnectSlack,
  exchangeSlackCodeAndSave,
  getSlackAuthorizeUrl,
  getSlackStatus,
} from '../integrations/slack/slackService';
import { generateRandomState } from '../utils/crypto';

const SLACK_STATE_COOKIE = 'reachinbox_slack_state';

export async function handleSlackConnect(req: Request, res: Response): Promise<void> {
  const state = `${req.user!.id}:${generateRandomState(16)}`;
  res.cookie(SLACK_STATE_COOKIE, state, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/',
  });

  const url = getSlackAuthorizeUrl(state);
  if (req.query.mode === 'json') {
    res.status(200).json({ success: true, data: { url } });
    return;
  }
  res.redirect(url);
}

export async function handleSlackCallback(req: Request, res: Response): Promise<void> {
  const code = typeof req.query.code === 'string' ? req.query.code : undefined;
  const state = typeof req.query.state === 'string' ? req.query.state : undefined;
  const expectedState = req.cookies?.[SLACK_STATE_COOKIE];

  res.clearCookie(SLACK_STATE_COOKIE, { path: '/' });

  if (!code || !state || !expectedState || state !== expectedState) {
    res.redirect(`${env.FRONTEND_URL}/settings?slack=error&reason=invalid_state`);
    return;
  }

  const [userId] = state.split(':');
  if (!userId) {
    res.redirect(`${env.FRONTEND_URL}/settings?slack=error&reason=missing_user`);
    return;
  }

  try {
    await exchangeSlackCodeAndSave(userId, code);
    res.redirect(`${env.FRONTEND_URL}/settings?slack=connected`);
  } catch (err) {
    const reason = encodeURIComponent((err as Error).message || 'oauth_failed');
    res.redirect(`${env.FRONTEND_URL}/settings?slack=error&reason=${reason}`);
  }
}

export async function handleSlackStatus(req: Request, res: Response): Promise<void> {
  const status = await getSlackStatus(req.user!.id);
  res.status(200).json({
    success: true,
    data: status,
  });
}

export async function handleSlackDisconnect(req: Request, res: Response): Promise<void> {
  await disconnectSlack(req.user!.id);
  res.status(200).json({
    success: true,
    message: 'Slack disconnected successfully',
  });
}
