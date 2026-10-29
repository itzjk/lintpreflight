import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = new URL('../', import.meta.url);
for (const [name, file, before, after, testName] of [
  ['removed API detector', 'lib/detect.mjs', "Object.hasOwn(migration.members, name)", 'false', 'synthetic issue pattern'],
  ['peer accepted as runtime guarantee', 'lib/inspect.mjs', 'directory && installed ? await scan(directory)', 'directory && installed && acceptsTarget !== true ? await scan(directory)', 'compatible peer still scans old API'],
  ['empty declared peer ignored', 'lib/inspect.mjs', '!request.required && !declaresPeer', '!request.required && !peer', 'custom package with declared']
]) {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'lintpreflight-mutation-'));
  try {
    for (const folder of ['bin', 'lib', 'test']) await fs.cp(new URL(folder, root), path.join(temp, folder), { recursive: true });
    await fs.symlink(new URL('node_modules', root).pathname, path.join(temp, 'node_modules'));
    const target = path.join(temp, file);
    const source = await fs.readFile(target, 'utf8');
    if (!source.includes(before)) throw new Error('Mutation anchor missing: ' + name);
    await fs.writeFile(target, source.replace(before, after));
    const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-name-pattern', testName, 'test/cli.test.mjs'], { cwd: temp, encoding: 'utf8', timeout: 15000 });
    if (result.error || result.status !== 1 || !result.stdout.includes('not ok')) throw new Error('Mutation survived or failed to run: ' + name + '\n' + result.stdout + result.stderr);
    console.log('KILLED: ' + name);
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
}
