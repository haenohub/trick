import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const output = new URL('../dist/', import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(new URL('../site/', import.meta.url), output, { recursive: true });
const manifest = {
  kind: 'pages-smoke',
  commit: process.env.GITHUB_SHA || 'local',
  builtAt: new Date().toISOString()
};
await writeFile(new URL('deployment.json', output), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(new URL('.nojekyll', output), '');
console.log(`Built static deployment test: ${fileURLToPath(output)}`);
