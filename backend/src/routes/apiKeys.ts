import { Router } from 'express';
import { randomBytes } from 'crypto';
import config from '../config.js';
import { connectDb } from '../db.js';
import { signJwt } from '../services/jwt.js';
import { checkRateLimit } from '../services/rateLimiter.js';

const router = Router();

function normalizeTargetUrl(value: unknown) {
  if (!value) return null;
  const url = new URL(String(value));
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('targetUrl must use http or https');
  }
  return url.toString().replace(/\/$/, '');
}

router.get('/keys', async (_req, res) => {
  const client = await connectDb();
  const result = await client.query(
    `SELECT
       k.api_key,
       k.owner,
       k.quota,
       k.target_url,
       k.revoked,
       k.created_at,
       COUNT(u.id)::int AS requests,
       MAX(u.created_at) AS last_request
     FROM api_keys k
     LEFT JOIN api_usage u ON u.api_key = k.api_key
     GROUP BY k.id
     ORDER BY k.created_at DESC`
  );

  res.json({ keys: result.rows });
});

router.post('/generate', async (req, res) => {
  const owner = req.body.owner ?? 'unknown';
  const quota = Number(req.body.quota ?? 1000);
  let targetUrl: string | null = null;
  try {
    targetUrl = normalizeTargetUrl(req.body.targetUrl);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid targetUrl' });
  }

  if (!Number.isFinite(quota) || quota < 1) {
    return res.status(400).json({ error: 'quota must be greater than 0' });
  }

  const apiKey = `${config.apiKeyPrefix}${randomBytes(18).toString('base64url')}`;
  const client = await connectDb();

  await client.query(
    'INSERT INTO api_keys(api_key, owner, quota, target_url) VALUES($1, $2, $3, $4)',
    [apiKey, owner, quota, targetUrl]
  );

  const token = signJwt({ apiKey, owner });
  res.status(201).json({ apiKey, owner, quota, targetUrl, token });
});

router.post('/validate', async (req, res) => {
  const apiKey = req.body.apiKey;
  if (!apiKey) {
    return res.status(400).json({ error: 'apiKey is required' });
  }

  const client = await connectDb();
  const result = await client.query('SELECT * FROM api_keys WHERE api_key = $1', [apiKey]);
  if (result.rowCount === 0) {
    return res.status(404).json({ valid: false });
  }
  if (result.rows[0].revoked) {
    return res.status(403).json({ valid: false, error: 'API key is revoked' });
  }

  const rateLimit = await checkRateLimit(apiKey);
  return res.json({ valid: true, allowed: rateLimit.allowed, rateLimit, key: result.rows[0] });
});

router.patch('/keys/:apiKey', async (req, res) => {
  const quota = req.body.quota === undefined ? undefined : Number(req.body.quota);
  let targetUrl: string | null | undefined;

  try {
    targetUrl = req.body.targetUrl === undefined ? undefined : normalizeTargetUrl(req.body.targetUrl);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid targetUrl' });
  }

  if (quota !== undefined && (!Number.isFinite(quota) || quota < 1)) {
    return res.status(400).json({ error: 'quota must be greater than 0' });
  }

  const client = await connectDb();
  const result = await client.query(
    `UPDATE api_keys
     SET quota = COALESCE($2, quota),
         target_url = COALESCE($3, target_url),
         revoked = COALESCE($4, revoked)
     WHERE api_key = $1
     RETURNING *`,
    [req.params.apiKey, quota, targetUrl, req.body.revoked]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'API key not found' });
  }

  res.json({ key: result.rows[0] });
});

router.delete('/keys/:apiKey', async (req, res) => {
  const client = await connectDb();
  const result = await client.query(
    'UPDATE api_keys SET revoked = TRUE WHERE api_key = $1 RETURNING *',
    [req.params.apiKey]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'API key not found' });
  }

  res.json({ key: result.rows[0] });
});

export default router;
