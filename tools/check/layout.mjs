// kit check step 5, layout: render each screen at phone width and report faults a small model can act on
// (spec 6.5: overflow, overlap, tap targets, contrast, use of app.css). Screens come from app.json `screens`.
import fs from 'node:fs';
import path from 'node:path';
import { serve, chromePath } from '../serve.mjs';

const VIEWPORT = { width: 390, height: 844 };
const PER_RULE = 5;

/** Runs in the page. Returns [{kind, detail}]. */
function inspect(perRule) {
  const out = [], count = {};
  const seen = new Set();
  const add = (kind, detail) => { const k = `${kind} ${detail}`; if (seen.has(k)) return; seen.add(k); count[kind] = (count[kind] ?? 0) + 1; if (count[kind] <= perRule) out.push({ kind, detail }); };
  const name = el => el.tagName.toLowerCase() + (el.id ? `#${el.id}` : el.classList.length ? `.${[...el.classList].join('.')}` : '');
  const quote = s => JSON.stringify(s.replace(/\s+/g, ' ').trim().slice(0, 40));
  const ownText = el => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
  const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const texts = [...document.body.querySelectorAll('*')].filter(el => ownText(el) && visible(el) && !['SCRIPT', 'STYLE', 'OPTION'].includes(el.tagName));

  if (document.documentElement.scrollWidth > innerWidth) add('wide', `the page is ${document.documentElement.scrollWidth}px wide on a ${innerWidth}px screen`);

  for (const el of texts) {
    const s = getComputedStyle(el);
    if (el.scrollWidth > el.clientWidth + 1 && /hidden|clip/.test(s.overflowX)) add('cut off', `${quote(ownText(el))} in ${name(el)} needs ${el.scrollWidth}px but has ${el.clientWidth}px`);
  }

  // Overlaps: text whose box meets a pinned bar (sticky or fixed) that scrolling cannot move it away from.
  // A top bar is checked at scroll 0, a bottom bar with the page scrolled to its end.
  const bars = [...document.body.querySelectorAll('*')].filter(e => /sticky|fixed/.test(getComputedStyle(e).position) && visible(e));
  const overlapPass = edge => {
    for (const bar of bars) {
      const c = bar.getBoundingClientRect();
      if (edge === 'top' ? c.top > 1 : c.bottom < innerHeight - 1) continue;
      for (const el of texts) {
        if (bar.contains(el) || el.contains(bar) || !el.closest('main')) continue;
        const r = el.getBoundingClientRect();
        if (r.bottom > c.top && r.top < c.bottom && r.right > c.left && r.left < c.right) add('overlaps', `${quote(ownText(el))} (${name(el)}) overlaps ${name(bar)}`);
      }
    }
  };
  const y0 = scrollY;
  scrollTo(0, 0); overlapPass('top');
  scrollTo(0, document.documentElement.scrollHeight); overlapPass('bottom');
  scrollTo(0, y0);

  for (const el of document.body.querySelectorAll('button, a[href], select, input:not([type=hidden]), [role=tab]')) {
    if (!visible(el)) continue;
    const box = (el.tagName === 'INPUT' && el.closest('label')) || el;
    const r = box.getBoundingClientRect();
    if (r.width < 44 || r.height < 44) add('tap target', `${name(box)} is ${Math.round(r.width)}x${Math.round(r.height)} px, under 44x44`);
  }

  const rgba = c => {
    let m = c.match(/^rgba?\(([^)]+)\)/);
    if (m) { const v = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [v[0], v[1], v[2], v[3] ?? 1]; }
    m = c.match(/^color\(srgb ([^)]+)\)/);
    if (m) { const [rgb, a] = m[1].split('/'); const v = rgb.trim().split(/\s+/).map(n => Number(n) * 255); return [...v, a ? Number(a) : 1]; }
    return null;
  };
  const over = (top, bottom) => [0, 1, 2].map(i => top[i] * top[3] + bottom[i] * (1 - top[3])).concat(1);
  const background = el => {
    const layers = [];
    for (let e = el; e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break; } }
    return layers.reverse().reduce((acc, c) => over(c, acc), [255, 255, 255, 1]);
  };
  const lum = c => { const [r, g, b] = c.slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  for (const el of texts) {
    const s = getComputedStyle(el), fg = rgba(s.color);
    if (!fg) continue;
    const bg = background(el), col = over(fg, bg);
    const [a, b] = [lum(col), lum(bg)].sort((p, q) => q - p), ratio = (a + 0.05) / (b + 0.05);
    const px = parseFloat(s.fontSize), large = px >= 24 || (px >= 18.66 && Number(s.fontWeight) >= 700);
    const need = large ? 3 : 4.5;
    if (ratio < need) add('contrast', `${ratio.toFixed(1)}:1 for ${quote(ownText(el))} (${name(el)}), needs ${need}:1`);
  }

  for (const el of document.body.querySelectorAll('[style]')) {
    const own = [...el.style].filter(p => !p.startsWith('--'));
    if (own.length) add('inline style', `${name(el)} sets ${own.slice(0, 3).join(', ')} in a style attribute; put it in app.css`);
  }
  return out;
}

/** (appDir) -> Promise<Fault[]> (rule 'layout') */
export async function layout(appDir) {
  const fault = message => ({ file: 'index.html', line: 1, rule: 'layout', message });
  let screens = [''];
  try { screens = JSON.parse(fs.readFileSync(path.join(appDir, 'app.json'), 'utf8')).screens ?? ['']; } catch { /* no manifest: one screen */ }
  let browser, srv;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ executablePath: chromePath() });
    srv = await serve(appDir);
  } catch (e) {
    await browser?.close();
    return [fault(`cannot run: ${String(e.message).split('\n')[0]}`)];
  }
  const out = [];
  try {
    for (const q of screens) {
      const page = await browser.newPage({ viewport: VIEWPORT });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      try {
        await page.goto(srv.url + (q ? `?${q}` : ''));
        await page.waitForFunction(() => document.querySelector('#app')?.textContent.trim().length > 0, null, { timeout: 10000 });
        await page.waitForTimeout(150);
        for (const f of await page.evaluate(inspect, PER_RULE)) out.push(fault(`[${q}] ${f.kind}: ${f.detail}`));
      } catch (e) {
        out.push(fault(`[${q}] did not render: ${String(e.message).split('\n')[0]}`));
      }
      for (const m of errors) out.push(fault(`[${q}] page error: ${m.split('\n')[0]}`));
      await page.close();
    }
  } finally { await browser.close(); await srv.close(); }
  return out;
}
