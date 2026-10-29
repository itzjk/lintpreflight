import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { limits, migration } from '../lib/eslint10.mjs';
const cli = fileURLToPath(new URL('../bin/lintpreflight.mjs', import.meta.url));

async function fixture(t, deps = { 'eslint-plugin-example': '*' }) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lintpreflight project '));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ devDependencies: deps }));
  return root;
}
async function write(root, file, content) {
  await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await fs.writeFile(path.join(root, file), content);
}
async function plugin(root, name = 'eslint-plugin-example', peer = '^10.0.0', code = 'module.exports = {};', file = 'index.js') {
  const directory = `node_modules/${name}`;
  await write(root, directory + '/package.json', JSON.stringify({ name, version: '1.2.3', peerDependencies: peer === null ? {} : { eslint: peer } }));
  await write(root, directory + '/' + file, code);
  return path.join(root, directory);
}
function run(root, args = ['--target', '10', '--json']) {
  const result = spawnSync(process.execPath, [cli, ...args, root], { encoding: 'utf8', timeout: 15000 });
  assert.ifError(result.error);
  return { ...result, report: args.includes('--json') ? JSON.parse(result.stdout) : null };
}

for (const [name, peer, code, state, exit] of [
  ['peer excludes target', '^9', 'module.exports = {};', 'peer-blocked', 1],
  ['compatible peer still scans old API', '^10', 'context.getFilename();', 'api-candidate', 1],
  ['modern API', '^10', 'context.filename; context.sourceCode.getText();', 'no-static-blockers-found', 0],
  ['comments and strings', '^10', '// context.getFilename()\nconst x = "context.getFilename()"; const y = `ctx.getSourceCode()`;', 'no-static-blockers-found', 0],
  ['missing peer', null, 'module.exports = {};', 'unknown', 2],
  ['invalid peer', 'gibberish', 'module.exports = {};', 'unknown', 2],
  ['empty peer is a valid wildcard', '', 'module.exports = {};', 'no-static-blockers-found', 0]
]) test(name, async t => {
  const root = await fixture(t);
  await plugin(root, undefined, peer, code);
  const { status, report } = run(root);
  assert.equal(status, exit);
  assert.deepEqual(report.packages[0].statuses, [state]);
  assert.equal(report.target, '10.0.0');
  assert.match(report.disclaimer, /No result certifies/);
});

test('synthetic issue pattern has exact file and line evidence', async t => {
  const root = await fixture(t);
  await plugin(root, undefined, '^10', 'function resolveBasedir(contextOrFilename) {\n  return contextOrFilename.getFilename();\n}', 'lib/util/version.js');
  const pkg = run(root).report.packages[0];
  assert.deepEqual(pkg.statuses, ['api-candidate']);
  assert.equal(pkg.findings[0].file, 'lib/util/version.js');
  assert.equal(pkg.findings[0].line, 2);
  assert.equal(pkg.findings[0].receiver, 'contextOrFilename');
  assert.equal(pkg.findings[0].replacement, 'context.filename');
});

test('aliases, ambiguous receivers, computed literals, optional calls and destructuring remain candidates', async t => {
  const root = await fixture(t);
  await plugin(root, undefined, '^10', 'const ctx = context;\nctx.getFilename();\nother["getSourceCode"]?.();\nconst fn = odd.getCwd; fn();\nconst {getPhysicalFilename: read} = ctx; read();');
  const pkg = run(root).report.packages[0];
  assert.equal(pkg.findings.length, 4);
  assert.ok(pkg.findings.every(item => item.confidence === 'candidate'));
  assert.deepEqual(pkg.findings.map(item => item.line), [2, 3, 4, 5]);
});

test('the versioned official subset is detected', async t => {
  const root = await fixture(t);
  const code = Object.entries(migration.members).map(([name, [, , kind]]) => `subject.${name}${kind === 'method' ? '()' : ''};`).join('\n');
  await plugin(root, undefined, '^10', code);
  assert.equal(run(root).report.packages[0].findings.length, Object.keys(migration.members).length);
});

for (const extension of ['mjs', 'cjs', 'js']) test(`scoped package with ${extension}`, async t => {
  const root = await fixture(t, { '@scope/eslint-plugin-demo': '*' });
  await plugin(root, '@scope/eslint-plugin-demo', '^9 || >=10.2.0', `${extension === 'cjs' ? 'module.exports = ' : 'export default '}ctx => ctx.getSourceCode();`, `lib/rule.${extension}`);
  const { report, status } = run(root, ['--target', '10.2.1', '--json']);
  assert.equal(status, 1);
  assert.equal(report.packages[0].acceptsTarget, true);
  assert.equal(report.packages[0].findings[0].api, 'context.getSourceCode');
});

for (const mode of ['missing', 'malformed', 'unreadable', 'invalid-version']) test(`metadata ${mode}`, async t => {
  const root = await fixture(t);
  const directory = await plugin(root);
  const file = path.join(directory, 'package.json');
  if (mode === 'missing') await fs.unlink(file);
  if (mode === 'malformed') await fs.writeFile(file, '{');
  if (mode === 'unreadable') { await fs.chmod(file, 0); t.after(() => fs.chmod(file, 0o644).catch(() => {})); }
  if (mode === 'invalid-version') await fs.writeFile(file, '{"version":"banana","peerDependencies":{"eslint":"^10"}}');
  assert.equal(run(root).status, 2);
});

test('missing installed package, no packages and opaque dependencies are unknown', async t => {
  for (const deps of [{ 'eslint-plugin-missing': '*' }, {}, { mystery: '*' }]) {
    const root = await fixture(t, deps);
    assert.equal(run(root).status, 2);
  }
});

test('metadata discovers custom parser and nested config dependencies', async t => {
  const root = await fixture(t, { 'custom-parser': '*', 'eslint-config-team': '*' });
  await plugin(root, 'custom-parser');
  const dir = await plugin(root, 'eslint-config-team');
  await write(dir, 'package.json', JSON.stringify({ version: '1.0.0', peerDependencies: { eslint: '^10' }, dependencies: { 'eslint-plugin-nested': '*' } }));
  await plugin(dir, 'eslint-plugin-nested', '^9');
  const report = run(root).report;
  assert.equal(report.packages.length, 3);
  assert.equal(report.exitCode, 1);
  assert.ok(report.packages.some(pkg => pkg.installedPath === 'node_modules/eslint-config-team/node_modules/eslint-plugin-nested'));
});

test('both blockers coexist and take precedence over unknown', async t => {
  const root = await fixture(t);
  await plugin(root, undefined, '^9', 'context.getFilename();\n');
  await write(root, 'node_modules/eslint-plugin-example/broken.js', 'const =');
  assert.deepEqual(run(root).report.packages[0].statuses, ['peer-blocked', 'api-candidate', 'unknown']);
  assert.equal(run(root).status, 1);
});

test('explicit exclusions list omitted paths without parsing fixtures', async t => {
  const root = await fixture(t);
  const dir = await plugin(root);
  for (const file of ['tests/bad.js', 'fixtures/bad.js', 'docs/bad.js', 'rule.spec.js', 'bundle.min.js']) await write(dir, file, 'context.getFilename();');
  const pkg = run(root).report.packages[0];
  assert.equal(pkg.findings.length, 0);
  assert.equal(pkg.coverage.omitted.filter(item => item.reason.startsWith('excluded')).length, 5);
});

for (const kind of ['large', 'many', 'deep', 'permissions', 'syntax', 'typescript', 'no-js']) test(`coverage gap: ${kind}`, async t => {
  const root = await fixture(t);
  const dir = await plugin(root);
  if (kind === 'large') await write(dir, 'huge.js', ' '.repeat(limits.fileBytes + 1));
  if (kind === 'many') for (let i = 0; i <= limits.files; i++) await write(dir, `part${i}.js`, '0;');
  if (kind === 'deep') await write(dir, 'deep/'.repeat(limits.depth + 1) + 'rule.js', '0;');
  if (kind === 'permissions') { await fs.chmod(path.join(dir, 'index.js'), 0); t.after(() => fs.chmod(path.join(dir, 'index.js'), 0o644).catch(() => {})); }
  if (kind === 'syntax') await write(dir, 'bad.js', 'const =');
  if (kind === 'typescript') await write(dir, 'rule.ts', 'const x: number = 1;');
  if (kind === 'no-js') await fs.unlink(path.join(dir, 'index.js'));
  const { status, report } = run(root);
  assert.equal(status, 2);
  assert.ok(report.packages[0].coverage.errors.length > 0);
});

test('package symlinks, metadata symlinks and internal cycles are not followed', async t => {
  const root = await fixture(t, { 'eslint-plugin-link': '*', 'eslint-plugin-example': '*', 'eslint-plugin-meta': '*' });
  const dir = await plugin(root);
  const meta = await plugin(root, 'eslint-plugin-meta');
  await fs.symlink(root, path.join(dir, 'cycle'));
  await fs.symlink(dir, path.join(root, 'node_modules/eslint-plugin-link'));
  await fs.unlink(path.join(meta, 'package.json'));
  await fs.symlink(path.join(dir, 'package.json'), path.join(meta, 'package.json'));
  const { status, report } = run(root);
  assert.equal(status, 2);
  assert.equal(report.packages.length, 3);
  assert.equal(report.packages.find(pkg => pkg.name === 'eslint-plugin-example').coverage.errors[0].reason, 'symlink-not-followed');
});

async function hashes(root) {
  const result = {};
  async function visit(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(file);
      else result[path.relative(root, file)] = createHash('sha256').update(await fs.readFile(file)).digest('hex');
    }
  }
  await visit(root);
  return result;
}

test('hashes unchanged and trap plugin/config never executed', async t => {
  const root = await fixture(t);
  const marker = path.join(root, 'EXECUTED');
  const trap = `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'bad'); throw new Error('executed');`;
  await plugin(root, undefined, '^10', trap);
  await write(root, 'eslint.config.js', trap);
  const before = await hashes(root);
  const first = run(root);
  assert.equal(first.status, 0);
  assert.deepEqual(await hashes(root), before);
  assert.equal(first.stdout, run(root).stdout);
  await assert.rejects(fs.access(marker));
});

test('invalid input and JSON errors have documented exits', async t => {
  const root = await fixture(t);
  for (const args of [['--target', '9', '--json'], ['--target', '^10', '--json'], ['--target', '10.1', '--json'], ['--target', '10.0.0-beta.1', '--json'], ['--wat', '--json'], ['--target', '10', '--json', '--json']]) {
    const result = run(root, args);
    assert.equal(result.status, 3);
    assert.equal(result.report.schemaVersion, 1);
    assert.equal(result.report.exitCode, 3);
  }
  await fs.writeFile(path.join(root, 'package.json'), '{');
  assert.equal(run(root).status, 3);
});

test('human output and help expose evidence and limits', async t => {
  const root = await fixture(t);
  await plugin(root, undefined, '^9', 'ctx.getFilename();');
  const result = run(root, ['--target', '10']);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /index.js:1:1/);
  assert.match(result.stdout, /peer-blocked, api-candidate/);
  const help = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /10.0.0/);
});

test('package discovery ceiling is surfaced as unknown', async t => {
  const deps = Object.fromEntries(Array.from({ length: limits.packages + 1 }, (_, i) => [`eslint-plugin-${i}`, '*']));
  const root = await fixture(t, deps);
  for (const name of Object.keys(deps)) await plugin(root, name);
  const { report, status } = run(root);
  assert.equal(status, 2);
  assert.equal(report.packages.length, limits.packages);
  assert.ok(report.warnings.includes('package-discovery-limit'));
});

test('aggregate byte ceiling leaves an explicit coverage gap', async t => {
  const root = await fixture(t);
  const dir = await plugin(root);
  const count = Math.ceil(limits.packageBytes / limits.fileBytes) + 1;
  for (let i = 0; i < count; i++) await write(dir, `large${i}.js`, ' '.repeat(limits.fileBytes));
  const { status, report } = run(root);
  assert.equal(status, 2);
  assert.ok(report.packages[0].coverage.bytes <= limits.packageBytes);
  assert.ok(report.packages[0].coverage.errors.some(item => item.reason === 'byte-limit'));
});

test('entry ceiling bounds large directories and reports unknown', async t => {
  const root = await fixture(t);
  const dir = await plugin(root);
  for (let i = 0; i <= limits.entries; i++) await write(dir, `asset${i}.txt`, '');
  const { status, report } = run(root);
  assert.equal(status, 2);
  assert.ok(report.packages[0].coverage.errors.some(item => item.reason === 'entry-limit'));
});

for (const peer of ['', null, false, 0]) test(`custom package with declared ${JSON.stringify(peer)} peer is discovered`, async t => {
  const root = await fixture(t, { 'lint-adapter': '*', 'eslint-plugin-control': '*' });
  const dir = await plugin(root, 'lint-adapter', '^10', 'contextOrFilename.getFilename();');
  await write(dir, 'package.json', JSON.stringify({ name: 'lint-adapter', version: '1.0.0', peerDependencies: { eslint: peer } }));
  await plugin(root, 'eslint-plugin-control');
  const { report, status } = run(root);
  assert.equal(status, 1);
  const pkg = report.packages.find(item => item.name === 'lint-adapter');
  assert.ok(pkg);
  assert.ok(pkg.statuses.includes('api-candidate'));
  assert.equal(pkg.acceptsTarget, peer === '' ? true : null);
  assert.equal(pkg.statuses.includes('unknown'), peer !== '');
});
