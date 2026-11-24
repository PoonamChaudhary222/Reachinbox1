import { getRedisClient } from '../config/redis';

const ACQUIRE_SEND_SLOT_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local minDelay = tonumber(ARGV[2])

if minDelay <= 0 then
  return {1, 0}
end

local nextAllowed = tonumber(redis.call('GET', key) or '0')
if now >= nextAllowed then
  local newNext = now + minDelay
  local ttl = math.max(minDelay * 3, 60000)
  redis.call('SET', key, newNext, 'PX', ttl)
  return {1, 0}
else
  return {0, nextAllowed}
end
`;

const CONSUME_HOURLY_QUOTA_LUA = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local ttlSeconds = tonumber(ARGV[2])

local current = tonumber(redis.call('GET', key) or '0')
if current >= limit then
  return {0, current}
end

local updated = redis.call('INCR', key)
if updated == 1 then
  redis.call('EXPIRE', key, ttlSeconds)
end
return {1, updated}
`;

export function getHourWindowKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  return `${y}${m}${d}${h}`;
}

export function getNextHourWindowStart(date: Date): Date {
  const nextHourMs = Math.floor(date.getTime() / 3600000) * 3600000 + 3600000;
  return new Date(nextHourMs);
}

export interface SendSlotResult {
  acquired: boolean;
  nextAllowedAtMs: number;
}

export async function acquirePerSenderSendSlot(
  senderId: string,
  minDelayMs: number,
  nowMs = Date.now()
): Promise<SendSlotResult> {
  if (minDelayMs <= 0) {
    return { acquired: true, nextAllowedAtMs: 0 };
  }
  const redis = getRedisClient();
  const key = `sender:next_slot:${senderId}`;
  const result = (await redis.eval(
    ACQUIRE_SEND_SLOT_LUA,
    1,
    key,
    String(nowMs),
    String(minDelayMs)
  )) as [number, number];

  return {
    acquired: result[0] === 1,
    nextAllowedAtMs: Number(result[1] || 0),
  };
}

export interface HourlyQuotaResult {
  allowed: boolean;
  currentCount: number;
  windowKey: string;
  nextWindowAt: Date;
}

export async function consumeSenderHourlyQuota(
  senderId: string,
  hourlyLimit: number,
  now = new Date()
): Promise<HourlyQuotaResult> {
  const redis = getRedisClient();
  const windowKey = getHourWindowKey(now);
  const key = `ratelimit:sender:${senderId}:hour:${windowKey}`;
  const result = (await redis.eval(
    CONSUME_HOURLY_QUOTA_LUA,
    1,
    key,
    String(hourlyLimit),
    '3700'
  )) as [number, number];

  return {
    allowed: result[0] === 1,
    currentCount: Number(result[1] || 0),
    windowKey,
    nextWindowAt: getNextHourWindowStart(now),
  };
}

export async function reserveNextWindowTimestamp(
  senderId: string,
  nextWindowAt: Date,
  minDelayMs: number
): Promise<Date> {
  const redis = getRedisClient();
  const nextWindowKey = getHourWindowKey(nextWindowAt);
  const offsetKey = `ratelimit:sender:${senderId}:next_offset:${nextWindowKey}`;
  const slotIndex = (await redis.incr(offsetKey)) - 1;
  if (slotIndex === 0) {
    await redis.expire(offsetKey, 7200);
  }
  const spacingMs = Math.max(minDelayMs, 500);
  return new Date(nextWindowAt.getTime() + slotIndex * spacingMs);
}

export async function claimSlackRateLimitNotification(
  senderId: string,
  windowKey: string
): Promise<boolean> {
  const redis = getRedisClient();
  const key = `slack:ratelimit_notified:${senderId}:${windowKey}`;
  const res = await redis.set(key, '1', 'EX', 3600, 'NX');
  return res === 'OK';
}
