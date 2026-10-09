import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const output = path.join(root, 'output');
const site = path.join(output, 'cloudflare-site');
fs.mkdirSync(output, { recursive: true });
const stage = fs.mkdtempSync(path.join(output, '.release-'));
const source = path.join(stage, 'territory-atlas');
try {
  fs.mkdirSync(source);
  // Explicit allowlist: never package credentials, account data, desktop bundles or node_modules.
  for (const name of ['src', 'tests', 'public', 'scripts', 'examples', 'docs', '.github', 'package.json', 'package-lock.json', 'vite.config.js', 'index.html', 'README.md', 'LICENSE', 'CONTRIBUTING.md', 'THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_LICENSES.txt', '.gitignore', '.nvmrc']) {
    fs.cpSync(path.join(root, name), path.join(source, name), { recursive: true });
  }
  fs.mkdirSync(site, { recursive: true });
  for (const entry of fs.readdirSync(site)) fs.rmSync(path.join(site, entry), { recursive: true });
  fs.cpSync(path.join(root, 'dist'), site, { recursive: true });
  // Public operators must opt into an address service suitable for aggregate website traffic.
  fs.writeFileSync(path.join(site, 'geocoding-config.json'), JSON.stringify({ endpoint: '' }, null, 2) + '\n');
  for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_LICENSES.txt']) fs.copyFileSync(path.join(root, name), path.join(site, name));
  const sourceZip = path.join(output, 'territory-atlas-source.zip');
  fs.rmSync(sourceZip, { force: true });
  execFileSync('/usr/bin/zip', ['-qr', sourceZip, 'territory-atlas'], { cwd: stage });
  fs.copyFileSync(sourceZip, path.join(site, 'territory-atlas-source.zip'));
  fs.copyFileSync(sourceZip, path.join(root, 'dist', 'territory-atlas-source.zip'));
  fs.cpSync(path.join(root, 'docs'), path.join(site, 'docs'), { recursive: true });
  const siteZip = path.join(output, 'territory-atlas-cloudflare.zip');
  fs.rmSync(siteZip, { force: true });
  execFileSync('/usr/bin/zip', ['-qr', siteZip, '.'], { cwd: site });
  const files = fs.readdirSync(site, { recursive: true }).map(name => path.join(site, name)).filter(file => fs.statSync(file).isFile());
  if (files.length > 1000 || files.some(file => fs.statSync(file).size > 25 * 1024 * 1024)) throw Error('Cloudflare drag-and-drop upload limits exceeded.');
  console.log(`Prepared ${files.length} public files in output/cloudflare-site and output/territory-atlas-cloudflare.zip. Source ZIP included. No deployment performed.`);
} finally { fs.rmSync(stage, { recursive: true, force: true }); }
