const examples = [
  {
    title: 'Create an API key',
    code: `curl -X POST http://localhost:4000/api/auth/generate \\
  -H "Content-Type: application/json" \\
  -d '{"owner":"demo-team","quota":1000,"targetUrl":"https://api.example.com"}'`,
  },
  {
    title: 'Call through the gateway',
    code: `curl http://localhost:4000/api/gateway/v1/orders \\
  -H "x-api-key: api_key_your_key_here"`,
  },
  {
    title: 'Read analytics',
    code: `curl http://localhost:4000/api/analytics/dashboard \\
  -H "Authorization: Bearer your_jwt_here"`,
  },
];

function Docs() {
  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Integration Guide</p>
          <h2>Developer Docs</h2>
        </div>
      </header>

      <section className="panel docs-grid">
        <article>
          <h3>Authentication</h3>
          <p>Client traffic uses the <code>x-api-key</code> header. Analytics endpoints use the JWT returned when a key is created.</p>
        </article>
        <article>
          <h3>Rate limiting</h3>
          <p>Each key is checked against the configured Redis-backed window. If Redis is offline, the backend falls back to an in-memory limiter for local development.</p>
        </article>
        <article>
          <h3>Quotas</h3>
          <p>Successful gateway requests count toward the key quota. Revoked, unknown, rate-limited, and quota-blocked calls are logged with a blocked reason.</p>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h3>Endpoints</h3>
          <span className="badge">REST API</span>
        </div>
        <div className="endpoint-list">
          <div><strong>GET /api/auth/keys</strong><span>List keys with usage totals.</span></div>
          <div><strong>POST /api/auth/generate</strong><span>Create a key, quota, target URL, and JWT.</span></div>
          <div><strong>POST /api/auth/validate</strong><span>Validate a key and inspect current rate-limit state.</span></div>
          <div><strong>DELETE /api/auth/keys/:apiKey</strong><span>Revoke a key without deleting historical analytics.</span></div>
          <div><strong>ALL /api/gateway/*</strong><span>Validate, rate-limit, quota-check, proxy, and log traffic.</span></div>
          <div><strong>GET /api/analytics/dashboard</strong><span>Return summaries, status mix, daily usage, and recent requests.</span></div>
        </div>
      </section>

      {examples.map((example) => (
        <section className="panel" key={example.title}>
          <h3>{example.title}</h3>
          <pre><code>{example.code}</code></pre>
        </section>
      ))}
    </div>
  );
}

export default Docs;
