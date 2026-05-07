import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ApiKeyRecord,
  DashboardPayload,
  GeneratedKey,
  callGateway,
  generateKey,
  listKeys,
  loadDashboard,
  revokeKey,
  validateKey,
} from '../api';

const storedToken = localStorage.getItem('gateway_token') ?? '';

function shortKey(value: string) {
  return `${value.slice(0, 12)}...${value.slice(-6)}`;
}

function Dashboard() {
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [token, setToken] = useState(storedToken);
  const [owner, setOwner] = useState('demo-team');
  const [quota, setQuota] = useState(1000);
  const [targetUrl, setTargetUrl] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const [gatewayPath, setGatewayPath] = useState('/v1/orders');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState<GeneratedKey | null>(null);
  const [loading, setLoading] = useState(false);

  const activeKeys = useMemo(() => keys.filter((key) => !key.revoked), [keys]);

  async function refresh(nextToken = token) {
    setError('');
    const keyData = await listKeys();
    setKeys(keyData.keys);
    if (!selectedKey && keyData.keys[0]) {
      setSelectedKey(keyData.keys[0].api_key);
    }

    if (nextToken) {
      const analytics = await loadDashboard(nextToken);
      setDashboard(analytics);
    }
  }

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, []);

  async function handleGenerate(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setNotice('');

    try {
      const key = await generateKey({ owner, quota, targetUrl });
      localStorage.setItem('gateway_token', key.token);
      setGenerated(key);
      setToken(key.token);
      setSelectedKey(key.apiKey);
      setNotice('API key created and dashboard token saved.');
      await refresh(key.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create key');
    } finally {
      setLoading(false);
    }
  }

  async function handleValidate() {
    if (!selectedKey) return;
    setLoading(true);
    setError('');
    setNotice('');

    try {
      const result = await validateKey(selectedKey);
      setNotice(`Key is ${result.allowed ? 'valid and allowed' : 'valid but rate limited'}: ${result.rateLimit.remaining}/${result.rateLimit.limit} requests remaining.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleGatewayCall() {
    if (!selectedKey) return;
    setLoading(true);
    setError('');
    setNotice('');

    try {
      await callGateway(selectedKey, gatewayPath);
      setNotice(`Gateway call recorded for ${gatewayPath}.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gateway call failed');
      await refresh().catch(() => undefined);
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(apiKey: string) {
    setLoading(true);
    setError('');
    setNotice('');

    try {
      await revokeKey(apiKey);
      setNotice('API key revoked.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke key');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Gateway Control Plane</p>
          <h2>Developer Dashboard</h2>
        </div>
        <button onClick={() => refresh().catch((err) => setError(err.message))} disabled={loading}>
          Refresh
        </button>
      </header>

      {(notice || error) && (
        <div className={error ? 'banner error' : 'banner'}>
          {error || notice}
        </div>
      )}

      <section className="metrics">
        <article>
          <span>Total requests</span>
          <strong>{dashboard?.summary.total_requests ?? 0}</strong>
        </article>
        <article>
          <span>Failed requests</span>
          <strong>{dashboard?.summary.failed_requests ?? 0}</strong>
        </article>
        <article>
          <span>Active keys</span>
          <strong>{dashboard?.summary.active_keys ?? activeKeys.length}</strong>
        </article>
        <article>
          <span>Avg latency</span>
          <strong>{dashboard?.summary.avg_latency_ms ?? 0} ms</strong>
        </article>
      </section>

      <div className="workspace-grid">
        <section className="panel">
          <div className="panel-heading">
            <h3>Create API Key</h3>
            <span className="badge">JWT issued</span>
          </div>
          <form className="form-grid" onSubmit={handleGenerate}>
            <label>
              Owner
              <input value={owner} onChange={(event) => setOwner(event.target.value)} required />
            </label>
            <label>
              Quota
              <input type="number" min="1" value={quota} onChange={(event) => setQuota(Number(event.target.value))} required />
            </label>
            <label className="full">
              Target URL
              <input value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} placeholder="https://api.example.com" />
            </label>
            <button className="primary" disabled={loading}>{loading ? 'Working...' : 'Generate key'}</button>
          </form>

          {generated && (
            <div className="secret-box">
              <span>New key</span>
              <code>{generated.apiKey}</code>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h3>Gateway Test</h3>
            <span className="badge">Live traffic</span>
          </div>
          <div className="form-grid">
            <label className="full">
              API key
              <select value={selectedKey} onChange={(event) => setSelectedKey(event.target.value)}>
                <option value="">Select a key</option>
                {keys.map((key) => (
                  <option key={key.api_key} value={key.api_key}>
                    {key.owner} - {shortKey(key.api_key)}
                  </option>
                ))}
              </select>
            </label>
            <label className="full">
              Path
              <input value={gatewayPath} onChange={(event) => setGatewayPath(event.target.value)} />
            </label>
            <button onClick={handleValidate} disabled={!selectedKey || loading}>Validate</button>
            <button className="primary" onClick={handleGatewayCall} disabled={!selectedKey || loading}>Send request</button>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <h3>API Keys</h3>
          <span className="badge">{keys.length} total</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Owner</th>
                <th>Key</th>
                <th>Quota</th>
                <th>Requests</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.api_key}>
                  <td>{key.owner}</td>
                  <td><code>{shortKey(key.api_key)}</code></td>
                  <td>{key.quota}</td>
                  <td>{key.requests ?? 0}</td>
                  <td><span className={key.revoked ? 'status revoked' : 'status'}>{key.revoked ? 'Revoked' : 'Active'}</span></td>
                  <td>
                    <button className="quiet" onClick={() => handleRevoke(key.api_key)} disabled={key.revoked || loading}>Revoke</button>
                  </td>
                </tr>
              ))}
              {keys.length === 0 && (
                <tr>
                  <td colSpan={6}>No API keys yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h3>Recent Requests</h3>
          <span className="badge">{dashboard?.recent.length ?? 0} events</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Method</th>
                <th>Path</th>
                <th>Status</th>
                <th>Latency</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {(dashboard?.recent ?? []).map((event) => (
                <tr key={`${event.api_key}-${event.created_at}-${event.path}`}>
                  <td>{event.method}</td>
                  <td>{event.path}</td>
                  <td>{event.status}</td>
                  <td>{event.latency_ms} ms</td>
                  <td>{event.blocked_reason ?? 'accepted'}</td>
                </tr>
              ))}
              {!dashboard?.recent.length && (
                <tr>
                  <td colSpan={5}>No gateway traffic has been recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
