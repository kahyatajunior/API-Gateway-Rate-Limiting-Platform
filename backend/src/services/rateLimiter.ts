import { createClient } from 'redis';
import config from '../config.js';

const redis = createClient({ url: config.redisUrl });
const memoryWindows = new Map<string, { count: number; expiresAt: number }>();
let redisAvailable = false;

const redisReady = redis.connect().then(() => {
  redisAvailable = true;
}).catch((err) => {
  console.error('Redis connection error', err);
  redisAvailable = false;
});

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  current: number;
  backend: 'redis' | 'memory';
};

export async function checkRateLimit(apiKey: string): Promise<RateLimitResult> {
  const key = `rate_limit:${apiKey}`;
  const limit = config.rateLimitRequests;

  await redisReady;

  if (redisAvailable) {
    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, config.rateLimitWindowSeconds);
      }
      const ttl = await redis.ttl(key);

      return {
        allowed: count <= limit,
        limit,
        remaining: Math.max(limit - count, 0),
        resetSeconds: ttl > 0 ? ttl : config.rateLimitWindowSeconds,
        current: count,
        backend: 'redis',
      };
    } catch (err) {
      redisAvailable = false;
      console.error('Redis rate limit failed, using in-memory limiter', err);
    }
  }

  const now = Date.now();
  const window = memoryWindows.get(key);
  const expiresAt = window && window.expiresAt > now
    ? window.expiresAt
    : now + config.rateLimitWindowSeconds * 1000;
  const count = window && window.expiresAt > now ? window.count + 1 : 1;

  memoryWindows.set(key, { count, expiresAt });

  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(limit - count, 0),
    resetSeconds: Math.max(Math.ceil((expiresAt - now) / 1000), 1),
    current: count,
    backend: 'memory',
  };
}

export default redis;
