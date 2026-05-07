import { Client } from 'pg';
import config from './config.js';

const client = new Client({ connectionString: config.databaseUrl });

export async function connectDb() {
  const alreadyConnected = (client as any)._connected || (client as any).connected;
  if (alreadyConnected) return client;
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id SERIAL PRIMARY KEY,
      api_key TEXT UNIQUE NOT NULL,
      owner TEXT NOT NULL,
      quota INTEGER NOT NULL DEFAULT 1000,
      target_url TEXT,
      revoked BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS api_usage (
      id SERIAL PRIMARY KEY,
      api_key TEXT NOT NULL,
      path TEXT NOT NULL,
      method TEXT NOT NULL,
      status INTEGER NOT NULL,
      latency_ms INTEGER NOT NULL DEFAULT 0,
      blocked_reason TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  await client.query(`
    ALTER TABLE api_keys
      ADD COLUMN IF NOT EXISTS target_url TEXT,
      ADD COLUMN IF NOT EXISTS revoked BOOLEAN NOT NULL DEFAULT FALSE;

    ALTER TABLE api_usage
      ADD COLUMN IF NOT EXISTS latency_ms INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS blocked_reason TEXT;
  `);
  return client;
}

export default client;
