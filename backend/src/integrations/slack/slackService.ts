import axios from 'axios';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { decryptSecret, encryptSecret } from '../../utils/crypto';
import { BadRequestError } from '../../utils/errors';

export interface SlackRateLimitNotification {
  userId: string;
  senderEmail: string;
  hourlyLimit: number;
  limitReachedAt: Date;
  delayedCount: number;
  nextWindowAt: Date;
}

export function getSlackAuthorizeUrl(state: string): string {
  if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) {
    throw new BadRequestError(
      'Slack OAuth is not configured. Please set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET.'
    );
  }
  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    scope: 'chat:write,channels:read,groups:read',
    redirect_uri: env.SLACK_REDIRECT_URI,
    state,
  });
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export async function exchangeSlackCodeAndSave(userId: string, code: string) {
  if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) {
    throw new BadRequestError('Slack OAuth client credentials are missing.');
  }

  const response = await axios.post(
    'https://slack.com/api/oauth.v2.access',
    new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: env.SLACK_REDIRECT_URI,
    }).toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    }
  );

  const data = response.data as {
    ok: boolean;
    error?: string;
    access_token?: string;
    team?: { id: string; name?: string };
    incoming_webhook?: { channel_id?: string; channel?: string };
  };

  if (!data.ok || !data.access_token || !data.team?.id) {
    throw new BadRequestError(`Slack OAuth failed: ${data.error || 'Unknown Slack error'}`);
  }

  let channelId = data.incoming_webhook?.channel_id || null;
  let channelName = data.incoming_webhook?.channel || null;

  if (!channelId) {
    try {
      const channelsRes = await axios.get('https://slack.com/api/conversations.list', {
        headers: { Authorization: `Bearer ${data.access_token}` },
        params: { types: 'public_channel,private_channel', limit: 25 },
        timeout: 10000,
      });
      const channels = (channelsRes.data?.channels || []) as Array<{
        id: string;
        name: string;
        is_member?: boolean;
      }>;
      const preferred =
        channels.find((c) => c.is_member) ||
        channels.find((c) => c.name === 'general') ||
        channels[0];
      if (preferred) {
        channelId = preferred.id;
        channelName = preferred.name;
      }
    } catch (err) {
      console.warn('[Slack] Could not fetch channels list:', (err as Error).message);
    }
  }

  const encryptedAccessToken = encryptSecret(data.access_token);

  return prisma.slackIntegration.upsert({
    where: { userId },
    create: {
      userId,
      encryptedAccessToken,
      teamId: data.team.id,
      teamName: data.team.name || null,
      channelId,
      channelName,
    },
    update: {
      encryptedAccessToken,
      teamId: data.team.id,
      teamName: data.team.name || null,
      channelId,
      channelName,
      connectedAt: new Date(),
    },
  });
}

export async function getSlackStatus(userId: string) {
  const integration = await prisma.slackIntegration.findUnique({
    where: { userId },
    select: {
      id: true,
      teamId: true,
      teamName: true,
      channelId: true,
      channelName: true,
      connectedAt: true,
    },
  });

  if (!integration) {
    return { connected: false, integration: null };
  }

  return { connected: true, integration };
}

export async function disconnectSlack(userId: string) {
  await prisma.slackIntegration.deleteMany({
    where: { userId },
  });
}

export async function sendSlackRateLimitAlert(
  payload: SlackRateLimitNotification
): Promise<boolean> {
  const integration = await prisma.slackIntegration.findUnique({
    where: { userId: payload.userId },
  });

  if (!integration) {
    return false;
  }

  const accessToken = decryptSecret(integration.encryptedAccessToken);
  let targetChannel = integration.channelId;

  if (!targetChannel) {
    const channelsRes = await axios.get('https://slack.com/api/conversations.list', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { types: 'public_channel,private_channel', limit: 20 },
      timeout: 10000,
    });
    const channels = (channelsRes.data?.channels || []) as Array<{
      id: string;
      name: string;
      is_member?: boolean;
    }>;
    const picked = channels.find((c) => c.is_member) || channels[0];
    if (!picked) {
      console.warn('[Slack] Connected workspace has no accessible channel for alert.');
      return false;
    }
    targetChannel = picked.id;
  }

  const text = [
    `:warning: *ReachInbox Hourly Rate Limit Reached*`,
    `• *Sender:* ${payload.senderEmail}`,
    `• *Hourly Limit:* ${payload.hourlyLimit} emails/hour`,
    `• *Reached At:* ${payload.limitReachedAt.toISOString()}`,
    `• *Delayed / Rescheduled Emails:* ${payload.delayedCount}`,
    `• *Next Scheduled Window:* ${payload.nextWindowAt.toISOString()}`,
  ].join('\n');

  const postRes = await axios.post(
    'https://slack.com/api/chat.postMessage',
    {
      channel: targetChannel,
      text,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    }
  );

  if (!postRes.data?.ok) {
    console.error('[Slack] chat.postMessage error:', postRes.data?.error);
    return false;
  }

  return true;
}
