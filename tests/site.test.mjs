import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';

test('published artifact contains only the intended public files', async () => {
  const files = (await readdir(new URL('../dist/', import.meta.url))).sort();
  assert.deepEqual(files, ['.nojekyll', 'app.js', 'deployment.json', 'index.html', 'styles.css']);
  const manifest = JSON.parse(await readFile(new URL('../dist/deployment.json', import.meta.url), 'utf8'));
  assert.equal(manifest.kind, 'pages-smoke');
  assert.ok(manifest.commit === 'local' || /^[0-9a-f]{40}$/.test(manifest.commit));
  assert.ok(Number.isFinite(Date.parse(manifest.builtAt)));
});

test('page and relative assets work beneath the GitHub project path', async () => {
  const publicFiles = new Set(['index.html', 'app.js', 'styles.css', 'deployment.json']);
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const name = pathname.startsWith('/trick/') ? pathname.slice('/trick/'.length) || 'index.html' : '';
    if (!publicFiles.has(name)) { response.writeHead(404).end(); return; }
    try {
      response.end(await readFile(new URL(`../dist/${name}`, import.meta.url)));
    } catch { response.writeHead(500).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}/trick/`;
    const page = await fetch(base);
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /리프테일/);
    const assets = [...html.matchAll(/(?:href|src)="(\.\/[^\"]+)"/g)].map(match => match[1]);
    assert.deepEqual(assets.sort(), ['./app.js', './styles.css']);
    for (const asset of [...assets, './deployment.json']) {
      assert.equal((await fetch(new URL(asset, base))).status, 200, asset);
    }
    assert.equal((await fetch(new URL('/styles.css', base))).status, 404);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
