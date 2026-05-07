import { Router } from 'express';
import { connectDb } from '../db.js';
const router = Router();
router.get('/usage', async (req, res) => {
    const client = await connectDb();
    const result = await client.query(`SELECT
       api_key,
       COUNT(*)::int AS requests,
       COUNT(*) FILTER (WHERE status >= 400)::int AS errors,
       ROUND(AVG(latency_ms))::int AS avg_latency_ms,
       MAX(created_at) AS last_request
     FROM api_usage
     GROUP BY api_key
     ORDER BY requests DESC
     LIMIT 100`);
    res.json({ usage: result.rows });
});
router.get('/dashboard', async (req, res) => {
    const client = await connectDb();
    const [daily, summary, statusMix, recent] = await Promise.all([
        client.query(`SELECT DATE(created_at) AS date, COUNT(*)::int AS requests
     FROM api_usage
     GROUP BY DATE(created_at)
     ORDER BY DATE(created_at) DESC
     LIMIT 30`),
        client.query(`SELECT
         COUNT(*)::int AS total_requests,
         COUNT(*) FILTER (WHERE status >= 400)::int AS failed_requests,
         COUNT(DISTINCT api_key)::int AS active_keys,
         ROUND(AVG(latency_ms))::int AS avg_latency_ms
       FROM api_usage`),
        client.query(`SELECT status, COUNT(*)::int AS requests
       FROM api_usage
       GROUP BY status
       ORDER BY requests DESC`),
        client.query(`SELECT api_key, path, method, status, latency_ms, blocked_reason, created_at
       FROM api_usage
       ORDER BY created_at DESC
       LIMIT 25`),
    ]);
    res.json({
        dashboard: daily.rows,
        summary: summary.rows[0],
        statusMix: statusMix.rows,
        recent: recent.rows,
    });
});
router.get('/logs', async (_req, res) => {
    const client = await connectDb();
    const result = await client.query(`SELECT api_key, path, method, status, latency_ms, blocked_reason, created_at
     FROM api_usage
     ORDER BY created_at DESC
     LIMIT 100`);
    res.json({ logs: result.rows });
});
export default router;
//# sourceMappingURL=analytics.js.map