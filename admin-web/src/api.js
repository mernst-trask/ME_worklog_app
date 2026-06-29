// Change this if your backend runs somewhere other than localhost during development,
// or to your deployed backend URL in production.
const API_BASE_URL = 'https://shiny-meme-wrqvjq46qp6j39rjg-4000.app.github.dev';

const TOKEN_KEY = 'worklog_admin_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = 'GET', body } = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    throw new Error((data && data.error) || 'Request failed');
  }
  return data;
}

export const api = {
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request('/api/auth/me'),

  workers: () => request('/api/workers'),
  addWorker: (name, email, password) =>
    request('/api/workers', { method: 'POST', body: { name, email, password } }),
  resetWorkerPassword: (id, password) =>
    request(`/api/workers/${id}/password`, { method: 'PATCH', body: { password } }),
  removeWorker: (id) => request(`/api/workers/${id}`, { method: 'DELETE' }),

  monthLogs: (year, month, userId) =>
    request(`/api/worklogs?year=${year}&month=${month}${userId ? `&userId=${userId}` : ''}`),

  report: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/reports${qs ? `?${qs}` : ''}`);
  },

  // CSV export: fetch with the auth header (never put tokens in a URL), then
  // trigger a normal browser download from the resulting blob.
  downloadReportCsv: async (params = {}, filename = 'report.csv') => {
    const token = getToken();
    const qs = new URLSearchParams({ ...params, format: 'csv' }).toString();
    const res = await fetch(`${API_BASE_URL}/api/reports?${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Could not download report');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

export { API_BASE_URL };
