import { API_BASE_URL } from './config';

let authToken = null;
export function setAuthToken(token) {
  authToken = token;
}

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      // Only set this when there's a real body - on Android, React Native's
      // networking layer can write a single stray byte as the body when
      // Content-Type: application/json is set but there's nothing to send,
      // which the backend then fails to parse as JSON.
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message = (isJson && data && data.error) || 'Request failed';
    throw new Error(message);
  }
  return data;
}

export const api = {
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request('/api/auth/me'),

  today: (userId) => request(`/api/worklogs/today${userId ? `?userId=${userId}` : ''}`),
  clockIn: () => request('/api/worklogs/clock-in', { method: 'POST' }),
  clockOut: () => request('/api/worklogs/clock-out', { method: 'POST' }),
  addActivity: (date, hours, notes) =>
    request('/api/worklogs/manual', { method: 'POST', body: { date, hours, notes } }),
  editEntry: (id, hours, notes) =>
    request(`/api/worklogs/entry/${id}`, { method: 'PATCH', body: { hours, notes } }),
  deleteEntry: (id) => request(`/api/worklogs/entry/${id}`, { method: 'DELETE' }),

  monthLogs: (year, month, userId) =>
    request(`/api/worklogs?year=${year}&month=${month}${userId ? `&userId=${userId}` : ''}`),

  workers: () => request('/api/workers'),
  addWorker: (name, email, password) =>
    request('/api/workers', { method: 'POST', body: { name, email, password } }),
  removeWorker: (id) => request(`/api/workers/${id}`, { method: 'DELETE' }),

  report: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/reports${qs ? `?${qs}` : ''}`);
  },
};