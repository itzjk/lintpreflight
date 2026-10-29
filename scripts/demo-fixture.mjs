import fs from 'node:fs/promises';
import path from 'node:path';
const base = path.resolve('.demo');
for (const state of ['before', 'after']) {
  const root = path.join(base, state);
  const dependencies = { 'eslint-plugin-peer': '*', 'eslint-plugin-runtime': '*' };
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ private: true, devDependencies: dependencies }));
  for (const name of Object.keys(dependencies)) {
    const dir = path.join(root, 'node_modules', name);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify({ name, version: '1.0.0', peerDependencies: { eslint: state === 'before' && name.endsWith('peer') ? '^9' : '^10' } }));
    await fs.writeFile(path.join(dir, 'index.js'), name.endsWith('runtime') ? `export default function rule(contextOrFilename) {\n  return contextOrFilename.${state === 'before' ? 'getFilename()' : 'filename'};\n}\n` : 'export default {};\n');
  }
}
console.log('Ready: .demo/before and .demo/after');
