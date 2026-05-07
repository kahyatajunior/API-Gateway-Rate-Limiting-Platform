const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error ?? `Request failed with ${response.status}`);
  }

  return data as T;
}

export type ApiKeyRecord = {
  api_key: string;
  owner: string;
  quota: number;
  target_url: string | null;
  revoked: boolean;
  created_at: string;
  requests?: number;
  last_request?: string | null;
};

export type GeneratedKey = {
  apiKey: string;
  owner: string;
  quota: number;
  targetUrl: string | null;
  token: string;
};

export type RateLimit = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  current: number;
  backend: string;
};

export type DashboardPayload = {
  dashboard: Array<{ date: string; requests: number }>;
  summary: {
    total_requests: number;
    failed_requests: number;
    active_keys: number;
    avg_latency_ms: number | null;
  };
  statusMix: Array<{ status: number; requests: number }>;
  recent: Array<UsageLog>;
};

export type UsageLog = {
  api_key: string;
  path: string;
  method: string;
  status: number;
  latency_ms: number;
  blocked_reason: string | null;
  created_at: string;
};

export function listKeys() {
  return request<{ keys: ApiKeyRecord[] }>('/api/auth/keys');
}

export function generateKey(payload: { owner: string; quota: number; targetUrl: string }) {
  return request<GeneratedKey>('/api/auth/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function validateKey(apiKey: string) {
  return request<{ valid: boolean; allowed: boolean; rateLimit: RateLimit }>('/api/auth/validate', {
    method: 'POST',
    body: JSON.stringify({ apiKey }),
  });
}

export function revokeKey(apiKey: string) {
  return request<{ key: ApiKeyRecord }>(`/api/auth/keys/${encodeURIComponent(apiKey)}`, {
    method: 'DELETE',
  });
}

export function loadDashboard(token: string) {
  return request<DashboardPayload>('/api/analytics/dashboard', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function callGateway(apiKey: string, path: string) {
  return request<unknown>(`/api/gateway/${path.replace(/^\/+/, '')}`, {
    headers: { 'x-api-key': apiKey },
  });
}
