// Stand-in, replaced by the real kit. UI parts styled only through --kit-<token> custom properties.
const CSS = `
:root{--kit-accent:#2f6fd6;--kit-bg:#fff;--kit-text:#1a1a1a;--kit-radius:10px;--kit-space:12px;--kit-font:system-ui}
html,body{margin:0;background:var(--kit-bg);color:var(--kit-text);font-family:var(--kit-font)}
.kit-header{position:sticky;top:0;padding:var(--kit-space);background:var(--kit-accent);color:var(--kit-bg);font-weight:600}
.kit-tabs{display:flex;position:sticky;bottom:0;background:var(--kit-bg);border-top:1px solid color-mix(in srgb,var(--kit-text) 15%,transparent)}
.kit-tabs button{flex:1;min-height:44px;border:0;background:none;color:var(--kit-text);font:inherit}
.kit-tabs button[aria-selected=true]{color:var(--kit-accent);font-weight:600}
.kit-list{list-style:none;margin:0;padding:0}
.kit-list>li{padding:var(--kit-space);border-bottom:1px solid color-mix(in srgb,var(--kit-text) 10%,transparent)}
.kit-card{margin:var(--kit-space);padding:var(--kit-space);border-radius:var(--kit-radius);background:color-mix(in srgb,var(--kit-accent) 8%,var(--kit-bg))}
.kit-empty{padding:calc(var(--kit-space)*3);text-align:center;opacity:.7}
.kit-row{display:flex;gap:var(--kit-space);align-items:center;padding:var(--kit-space)}
.kit-row input,.kit-row select{flex:1;min-height:44px;font:inherit}
button{min-height:44px;min-width:44px;font:inherit}
.kit-list label{display:flex;align-items:center;gap:8px;min-height:44px}
`;

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

export function applyTheme(theme) {
  if (!document.getElementById('kit-css')) { const s = el('style'); s.id = 'kit-css'; s.textContent = CSS; document.head.prepend(s); }
  for (const [k, v] of Object.entries(theme ?? {})) document.documentElement.style.setProperty(`--kit-${k}`, String(v));
}
export function header(title) { const h = el('header', 'kit-header', title); h.setAttribute('role', 'banner'); return h; }
export function tabBar(tabs, active, onPick) {
  const nav = el('nav', 'kit-tabs'); nav.setAttribute('role', 'tablist');
  for (const t of tabs) {
    const b = el('button', null, t.label); b.setAttribute('role', 'tab'); b.dataset.tab = t.id;
    b.setAttribute('aria-selected', String(t.id === active)); b.addEventListener('click', () => onPick(t.id)); nav.append(b);
  }
  return nav;
}
export function list(items, render) { const ul = el('ul', 'kit-list'); for (const it of items) { const li = el('li'); li.append(render(it)); ul.append(li); } return ul; }
export function card({ title, body }) { const c = el('section', 'kit-card'); c.append(el('h3', null, title)); if (body instanceof Node) c.append(body); else if (body != null) c.append(el('p', null, body)); return c; }
export function emptyState(text) { return el('p', 'kit-empty', text); }
export function formRow(label, input) { const r = el('label', 'kit-row'); r.append(el('span', null, label), input); return r; }
