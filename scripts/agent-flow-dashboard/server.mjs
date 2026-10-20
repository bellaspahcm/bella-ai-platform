import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { authorizeRepository, REPOSITORY } from './authority.mjs';
import { listPackages, readPackage } from './evidence.mjs';

const assets = new Map([['/', ['index.html', 'text/html']], ['/app.js', ['app.js', 'text/javascript']], ['/style.css', ['style.css', 'text/css']]]);
const equal = (a, b) => typeof a === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function createDashboard({ root, authorize = () => authorizeRepository(REPOSITORY), now = Date.now, port = 0 } = {}) {
  const authority = await authorize(); // Fail closed before binding the listener.
  const token = randomBytes(32).toString('hex');
  const session = randomBytes(32).toString('hex');
  const cookieName = `bella_dev_${randomBytes(8).toString('hex')}`;
  const startedAt = now();
  let consumed = false;
  let origin;
  const server = http.createServer(async (req, res) => {
    const send = (status, data, type = 'application/json') => {
      res.writeHead(status, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'" });
      res.end(type === 'application/json' ? JSON.stringify(data) : data);
    };
    try {
      if (req.headers.host !== new URL(origin).host || (req.headers.origin && req.headers.origin !== origin)) return send(403, { error: 'ORIGIN_DENIED' });
      if (req.url === '/session' && req.method === 'POST') {
        if (req.headers.origin !== origin || req.headers['content-type'] !== 'application/json' || consumed || now() - startedAt > 5 * 60000) return send(403, { error: 'SESSION_DENIED' });
        let body = '';
        for await (const chunk of req) { body += chunk; if (body.length > 256) return send(413, { error: 'SIZE_DENIED' }); }
        let provided;
        try { provided = JSON.parse(body).token; } catch { return send(403, { error: 'SESSION_DENIED' }); }
        if (consumed || !equal(provided, token)) return send(403, { error: 'SESSION_DENIED' });
        consumed = true;
        await authorize(); // A failed check consumes the token too; restart to retry.
        res.setHeader('Set-Cookie', `${cookieName}=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600`);
        return send(200, { result: 'AUTHORIZED' });
      }
      if (req.method !== 'GET') return send(405, { error: 'READ_ONLY' });
      if (assets.has(req.url)) {
        const [file, type] = assets.get(req.url);
        return send(200, await readFile(new URL(file, import.meta.url)), type);
      }
      if (!req.url?.startsWith('/api/')) return send(404, { error: 'NOT_FOUND' });
      const cookie = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
      if (!equal(cookie, session) || now() - startedAt >= 3600000) return send(401, { error: 'LOCAL_SESSION_REQUIRED' });
      const verified = await authorize();
      if (req.url === '/api/packages') return send(200, { packages: await listPackages(root, now()), actor: verified.actor, checkedAt: new Date(now()).toISOString() });
      const match = /^\/api\/packages\/(bella-agent-flow-[A-Za-z0-9]{1,32})$/.exec(req.url);
      if (match) return send(200, await readPackage(root, match[1], now()));
      return send(404, { error: 'NOT_FOUND' });
    } catch {
      // No paths, GitHub stderr, payloads or credentials leave the backend.
      return send(403, { error: 'ACCESS_OR_EVIDENCE_UNAVAILABLE' });
    }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  return { server, origin, url: `${origin}/#${token}`, actor: authority.actor, close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dashboard = await createDashboard({ root: path.join(os.homedir(), '.codex', 'agent-flow-evidence') });
  console.log(`Bella Development Evidence Dashboard: ${dashboard.origin} (read-only, 1 hour session)`);
  if (process.argv.includes('--open')) execFile('rundll32.exe', ['url.dll,FileProtocolHandler', dashboard.url], { windowsHide: true }, error => { if (error) console.error('BROWSER_OPEN_FAILED'); });
  else console.log('Restart with --open to authorize a browser. No capability is logged or saved.');
  const stop = async () => { await dashboard.close(); process.exit(0); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
