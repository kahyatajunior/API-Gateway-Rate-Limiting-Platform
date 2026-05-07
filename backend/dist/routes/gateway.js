import { Router } from 'express';
import { connectDb } from '../db.js';
import { checkRateLimit } from '../services/rateLimiter.js';
const router = Router();
async function recordUsage(apiKey, path, method, status, latencyMs, blockedReason = null) {
    const client = await connectDb();
    await client.query(`INSERT INTO api_usage(api_key, path, method, status, latency_ms, blocked_reason)
     VALUES($1, $2, $3, $4, $5, $6)`, [apiKey, path, method, status, latencyMs, blockedReason]);
}
function getApiKey(req) {
    const headerKey = req.header('x-api-key');
    if (headerKey)
        return headerKey;
    const authHeader = req.header('authorization');
    if (authHeader?.startsWith('ApiKey ')) {
        return authHeader.replace('ApiKey ', '');
    }
    return null;
}
router.all('/*', async (req, res) => {
    const startedAt = Date.now();
    const apiKey = getApiKey(req);
    const gatewayPath = `/${req.params[0] ?? ''}`;
    if (!apiKey) {
        return res.status(401).json({ error: 'Missing x-api-key header' });
    }
    const client = await connectDb();
    const keyResult = await client.query(`SELECT
       k.*,
       COUNT(u.id)::int AS used
     FROM api_keys k
     LEFT JOIN api_usage u ON u.api_key = k.api_key AND u.blocked_reason IS NULL
     WHERE k.api_key = $1
     GROUP BY k.id`, [apiKey]);
    if (keyResult.rowCount === 0) {
        await recordUsage(apiKey, gatewayPath, req.method, 401, Date.now() - startedAt, 'unknown_key');
        return res.status(401).json({ error: 'Unknown API key' });
    }
    const key = keyResult.rows[0];
    if (key.revoked) {
        await recordUsage(apiKey, gatewayPath, req.method, 403, Date.now() - startedAt, 'revoked');
        return res.status(403).json({ error: 'API key is revoked' });
    }
    if (Number(key.used) >= Number(key.quota)) {
        await recordUsage(apiKey, gatewayPath, req.method, 429, Date.now() - startedAt, 'quota_exceeded');
        return res.status(429).json({ error: 'Quota exceeded', quota: Number(key.quota), used: Number(key.used) });
    }
    const rateLimit = await checkRateLimit(apiKey);
    if (!rateLimit.allowed) {
        await recordUsage(apiKey, gatewayPath, req.method, 429, Date.now() - startedAt, 'rate_limited');
        return res.status(429).json({ error: 'Rate limit exceeded', rateLimit });
    }
    if (!key.target_url) {
        const latencyMs = Date.now() - startedAt;
        await recordUsage(apiKey, gatewayPath, req.method, 200, latencyMs);
        return res.json({
            proxied: false,
            message: 'Gateway accepted the request. Add targetUrl to this API key to forward traffic.',
            path: gatewayPath,
            method: req.method,
            quota: { limit: Number(key.quota), used: Number(key.used) + 1 },
            rateLimit,
            latencyMs,
        });
    }
    const target = new URL(gatewayPath, key.target_url);
    for (const [name, value] of Object.entries(req.query)) {
        if (Array.isArray(value)) {
            value.forEach((item) => target.searchParams.append(name, String(item)));
        }
        else if (value !== undefined) {
            target.searchParams.set(name, String(value));
        }
    }
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
        if (!value || ['host', 'content-length', 'authorization', 'x-api-key'].includes(name.toLowerCase())) {
            continue;
        }
        headers.set(name, Array.isArray(value) ? value.join(',') : value);
    }
    headers.set('x-forwarded-api-key-owner', key.owner);
    try {
        const upstream = await fetch(target, {
            method: req.method,
            headers,
            body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body ?? {}),
        });
        const body = await upstream.text();
        const latencyMs = Date.now() - startedAt;
        await recordUsage(apiKey, gatewayPath, req.method, upstream.status, latencyMs);
        res.status(upstream.status);
        upstream.headers.forEach((value, name) => {
            if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(name.toLowerCase())) {
                res.setHeader(name, value);
            }
        });
        res.setHeader('x-gateway-rate-limit-remaining', String(rateLimit.remaining));
        return res.send(body);
    }
    catch (err) {
        const latencyMs = Date.now() - startedAt;
        await recordUsage(apiKey, gatewayPath, req.method, 502, latencyMs, 'upstream_error');
        return res.status(502).json({
            error: 'Upstream request failed',
            details: err instanceof Error ? err.message : 'Unknown upstream error',
        });
    }
});
export default router;
//# sourceMappingURL=gateway.js.map