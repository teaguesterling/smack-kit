// Static file server for layout verifiers and smoke tests. Port 0 = any free port.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.yaml': 'text/yaml; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };

export function serve(dir) {
  const root = path.resolve(dir);
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(root, url);
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    resolve({ url: `http://127.0.0.1:${port}/`, close: () => new Promise(r => { server.close(() => r()); server.closeAllConnections?.(); }) });   // a browser's keep-alive sockets would hold close() open
  }));
}

export function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const base = path.join(process.env.HOME ?? '', '.cache', 'ms-playwright');
  const dirs = fs.existsSync(base) ? fs.readdirSync(base).filter(d => /^chromium-\d+$/.test(d)).sort((a, b) => +b.split('-')[1] - +a.split('-')[1]) : [];
  for (const d of dirs) for (const sub of ['chrome-linux64', 'chrome-linux']) {   // Playwright 1.49 writes chrome-linux
    const p = path.join(base, d, sub, 'chrome'); if (fs.existsSync(p)) return p;
  }
  throw new Error('no Chromium found: set CHROME_PATH');
}
