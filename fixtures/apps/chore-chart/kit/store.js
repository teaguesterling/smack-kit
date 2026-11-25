// Stand-in, replaced by the real kit (utote kv shape). Data only: values are JSON, never run.
const memory = new Map();

function backend() {
  try { if (typeof localStorage !== 'undefined') return localStorage; } catch { /* blocked storage */ }
  return { getItem: k => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => { memory.set(k, String(v)); } };
}

export function openStore(name) {
  const b = backend();
  const key = k => `kit:${name}:${k}`;
  return {
    async get(k) { const raw = b.getItem(key(k)); return raw == null ? undefined : JSON.parse(raw); },
    async set(k, value) { b.setItem(key(k), JSON.stringify(value)); },
  };
}
