import dotenv from 'dotenv';

dotenv.config();

const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://gateway:gateway@localhost:5432/gateway',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET ?? 'change_this_secret',
  rateLimitWindowSeconds: Number(process.env.RATE_LIMIT_WINDOW_SECONDS ?? 60),
  rateLimitRequests: Number(process.env.RATE_LIMIT_REQUESTS ?? 100),
  apiKeyPrefix: process.env.API_KEY_PREFIX ?? 'api_key_',
};

export default config;
