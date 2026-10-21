import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/server.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const sibling = `${root}public-sibling`; // shares the "public" prefix on purpose
await mkdir(sibling, { recursive: true });
await writeFile(`${sibling}/secret.txt`, 'not for the web');

const server = createApp();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
// Raw request: fetch() would collapse "/../" before it ever reaches the server.
const get = (path) =>
  new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: server.address().port, path }, (res) => {
      let text = '';
      res.on('data', (c) => (text += c));
      res.on('end', () => resolve({ status: res.statusCode, text: async () => text }));
    }).on('error', reject);
  });

after(async () => {
  server.close();
  await rm(sibling, { recursive: true, force: true });
});

test('serves the form', async () => {
  assert.equal((await get('/')).status, 200);
});

test('does not serve files outside public/, including siblings that share the prefix', async () => {
  for (const path of ['/../package.json', '/../src/server.js', '/../public-sibling/secret.txt']) {
    const res = await get(path);
    assert.ok([403, 404].includes(res.status), `${path} -> ${res.status}`);
    assert.doesNotMatch(await res.text(), /not for the web|"name"/);
  }
});

test('triage endpoint rejects empty input and oversized bodies', async () => {
  const post = (body) => fetch(`${base}/api/triage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
  assert.equal((await post(JSON.stringify({ email: '  ' }))).status, 400);
  assert.equal((await post(JSON.stringify({ email: 'x'.repeat(60_000) }))).status, 413);
});
