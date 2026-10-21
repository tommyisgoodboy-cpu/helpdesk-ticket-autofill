import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { USERS } from './directory.js';
import { resolveMode, triage } from './triage.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PUBLIC = join(ROOT, 'public');
const EXAMPLES = join(ROOT, 'examples');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const MAX_BODY = 50_000;
const PICKER_LATENCY_MS = 150; // simulates a slow user-search backend

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error('Body too large'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function serveStatic(res, pathname) {
  const file = normalize(join(PUBLIC, pathname === '/' ? 'index.html' : pathname));
  if (file !== PUBLIC && !file.startsWith(PUBLIC + sep)) return json(res, 403, { error: 'Forbidden' });
  let body;
  try {
    body = await readFile(file);
  } catch {
    return json(res, 404, { error: 'Not found' });
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(body);
}

export function createApp() {
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (req.method === 'GET' && url.pathname === '/api/users') {
        const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
        const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 20));
        await new Promise((r) => setTimeout(r, PICKER_LATENCY_MS));
        const users = USERS.slice(offset, offset + limit).map(({ id, name, department }) => ({ id, name, department }));
        return json(res, 200, { users, total: USERS.length, next: offset + users.length < USERS.length ? offset + limit : null });
      }
      if (req.method === 'GET' && url.pathname === '/api/examples') {
        const files = (await readdir(EXAMPLES)).filter((f) => f.endsWith('.txt')).sort();
        const items = await Promise.all(files.map(async (f) => ({ name: f.replace(/\.txt$/, ''), text: await readFile(join(EXAMPLES, f), 'utf8') })));
        return json(res, 200, { mode: resolveMode(), items });
      }
      if (req.method === 'POST' && url.pathname === '/api/triage') {
        const { email } = JSON.parse(await readBody(req));
        if (typeof email !== 'string' || !email.trim()) return json(res, 400, { error: 'email is required' });
        return json(res, 200, await triage(email));
      }
      if (req.method === 'GET') return serveStatic(res, url.pathname);
      json(res, 405, { error: 'Method not allowed' });
    } catch (err) {
      json(res, err.status ?? 500, { error: err.message });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3000;
  createApp().listen(port, '127.0.0.1', () => {
    console.log(`Demo form on http://localhost:${port}  (triage mode: ${resolveMode()})`);
  });
}
