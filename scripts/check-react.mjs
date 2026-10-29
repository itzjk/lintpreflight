import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { inspect } from '../lib/inspect.mjs';
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lintpreflight-react-'));
try {
  const packed = JSON.parse(execFileSync('npm', ['pack', 'eslint-plugin-react@7.37.5', '--ignore-scripts', '--json', '--cache', path.join(root, 'cache'), '--pack-destination', root], { encoding: 'utf8', timeout: 60000 }))[0];
  const directory = path.join(root, 'node_modules/eslint-plugin-react');
  await fs.mkdir(directory, { recursive: true });
  execFileSync('tar', ['-xzf', path.join(root, packed.filename), '-C', directory, '--strip-components=1'], { timeout: 15000 });
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ devDependencies: { 'eslint-plugin-react': '7.37.5' } }));
  const report = await inspect(root, '10');
  const pkg = report.packages.find(item => item.name === 'eslint-plugin-react');
  const evidence = pkg.findings.find(item => item.file === 'lib/util/version.js' && item.receiver === 'contextOrFilename' && item.api === 'context.getFilename');
  assert.equal(pkg.version, '7.37.5');
  assert.ok(evidence, 'Published package must contain the issue pattern');
  assert.ok(pkg.statuses.includes('peer-blocked'));
  assert.ok(pkg.statuses.includes('api-candidate'));
  console.log(JSON.stringify({ checked: new Date().toISOString().slice(0, 10), package: pkg.name, version: pkg.version, integrity: packed.integrity, peerRange: pkg.peerRange, statuses: pkg.statuses, filesScanned: pkg.coverage.files, candidates: pkg.findings.length, evidence, source: 'https://registry.npmjs.org/eslint-plugin-react/7.37.5' }, null, 2));
} finally { await fs.rm(root, { recursive: true, force: true }); }
