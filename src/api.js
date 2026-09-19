async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`);
  return data;
}

export const api = {
  state: () => request('/api/state'),
  resolve: (contextId) => request(`/api/resolve/${encodeURIComponent(contextId)}`),
  reset: () => request('/api/reset', { method: 'POST' }),

  addContext: (payload) => request('/api/contexts', { method: 'POST', body: JSON.stringify(payload) }),
  renameContext: (id, name) =>
    request(`/api/contexts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),
  deleteContext: (id) => request(`/api/contexts/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  addCommand: (payload) => request('/api/commands', { method: 'POST', body: JSON.stringify(payload) }),
  updateCommand: (id, payload) =>
    request(`/api/commands/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteCommand: (id) => request(`/api/commands/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
