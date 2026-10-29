import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import semver from 'semver';
import { detect } from './detect.mjs';
import { migration, limits, ignoredDirectories, javascript, ignoredFiles } from './eslint10.mjs';

export class InputError extends Error {}
const slash = value => value.split(path.sep).join('/');
const named = name => /(?:^|\/)(?:eslint-plugin(?:-|$)|eslint-config(?:-|$))/.test(name) || name === '@eslint/js' || /(?:eslint.*parser|parser.*eslint|typescript-eslint)/.test(name);
const packageName = name => /^(?:@[a-z0-9._~-]+\/)?[a-z0-9._~-]+$/i.test(name) && !name.split('/').some(part => part === '.' || part === '..');
const dependencyNames = meta => [...new Set(['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'].flatMap(field => Object.keys(meta[field] && typeof meta[field] === 'object' && !Array.isArray(meta[field]) ? meta[field] : {})))].filter(name => name !== 'eslint').sort();
const within = (root, file) => file === root || file.startsWith(root + path.sep);

async function regularRead(file, max) {
  const handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > max || (stat.mode & 0o444) === 0) throw new Error('not-readable-or-size-limit');
    const data = Buffer.alloc(max + 1);
    let length = 0;
    while (length < data.length) {
      const { bytesRead } = await handle.read(data, length, data.length - length, length);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > max) throw new Error('size-limit');
    return data.subarray(0, length).toString('utf8');
  } finally {
    await handle.close();
  }
}

async function metadata(directory) {
  const value = JSON.parse(await regularRead(path.join(directory, 'package.json'), limits.metadataBytes));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid-metadata');
  return value;
}

async function safePath(root, target) {
  if (!within(root, target)) throw new Error('outside-project');
  let current = root;
  for (const part of path.relative(root, target).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const stat = await fs.lstat(current);
    if (stat.isSymbolicLink()) throw new Error('symlink-not-followed');
  }
  return target;
}

async function resolvePackage(root, from, name) {
  if (!packageName(name)) throw new Error('invalid-package-name');
  let directory = from;
  while (within(root, directory)) {
    const target = path.join(directory, 'node_modules', name);
    try {
      return await safePath(root, target);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (directory === root) break;
    directory = path.dirname(directory);
  }
  throw new Error('not-installed');
}

async function scan(directory) {
  const findings = [];
  const omitted = [];
  const errors = [];
  let entries = 0;
  let files = 0;
  let bytes = 0;
  const add = (file, reason, unknown = false) => {
    (unknown ? errors : omitted).push({ file: slash(path.relative(directory, file)) || '.', reason });
  };
  async function walk(folder, depth) {
    if (depth > limits.depth) return add(folder, 'depth-limit', true);
    const stat = await fs.lstat(folder);
    if ((stat.mode & 0o555) === 0) return add(folder, 'unreadable-directory', true);
    const dir = await fs.opendir(folder);
    const items = [];
    for await (const entry of dir) {
      if (++entries > limits.entries) {
        add(folder, 'entry-limit', true);
        break;
      }
      items.push(entry);
    }
    for (const entry of items.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const file = path.join(folder, entry.name);
      if (entry.isSymbolicLink()) { add(file, 'symlink-not-followed', true); continue; }
      if (entry.isDirectory()) {
        if (ignoredDirectories.has(entry.name.toLowerCase())) add(file, 'excluded-directory');
        else if (entries <= limits.entries) {
          try { await walk(file, depth + 1); } catch { add(file, 'unreadable-directory', true); }
        } else add(file, 'entry-limit', true);
        continue;
      }
      if (!entry.isFile()) { add(file, 'non-regular-file', true); continue; }
      if (ignoredFiles.test(entry.name)) { add(file, 'excluded-file'); continue; }
      if (!javascript.test(entry.name)) {
        if (!/\.d\.ts$/i.test(entry.name) && /\.(?:[cm]?tsx?|jsx)$/i.test(entry.name)) add(file, 'unsupported-syntax-file', true);
        else add(file, 'non-javascript');
        continue;
      }
      if (files >= limits.files) { add(file, 'file-count-limit', true); continue; }
      try {
        const stat = await fs.lstat(file);
        if (stat.size > limits.fileBytes || bytes + stat.size > limits.packageBytes) { add(file, 'byte-limit', true); continue; }
        const source = await regularRead(file, Math.min(limits.fileBytes, limits.packageBytes - bytes));
        files++;
        bytes += Buffer.byteLength(source);
        try {
          findings.push(...detect(source).map(item => ({ file: slash(path.relative(directory, file)), ...item })));
        } catch { add(file, 'parse-error', true); }
      } catch { add(file, 'unreadable-file', true); }
    }
  }
  try { await walk(directory, 0); } catch { add(directory, 'unreadable-directory', true); }
  if (!files) errors.push({ file: '.', reason: 'no-javascript-scanned' });
  return { findings, coverage: { files, bytes, omitted, errors } };
}

export function targetVersion(value) {
  const target = value === '10' ? '10.0.0' : semver.valid(value);
  if (!target || semver.major(target) !== migration.targetMajor || semver.prerelease(target)) throw new InputError('Target must be 10 or a precise stable 10.x.y version.');
  return target;
}

export async function inspect(project, targetValue) {
  const target = targetVersion(targetValue);
  let root;
  let meta;
  try {
    root = await fs.realpath(path.resolve(project));
    meta = await metadata(root);
  } catch { throw new InputError('Project must contain a readable, valid package.json.'); }
  const queue = dependencyNames(meta).map(name => ({ name, from: root, required: named(name) }));
  const packages = [];
  const warnings = [];
  const seen = new Set();
  const attempted = new Set();
  let probes = 0;
  while (queue.length) {
    const request = queue.shift();
    const key = `${request.from}:${request.name}`;
    if (attempted.has(key)) continue;
    attempted.add(key);
    if (++probes > limits.packages) { warnings.push('package-discovery-limit'); break; }
    let directory;
    let installed;
    let failure;
    try {
      directory = await resolvePackage(root, request.from, request.name);
      if (seen.has(directory)) continue;
      installed = await metadata(directory);
    } catch (error) { failure = error.message; }
    const peer = installed?.peerDependencies?.eslint;
    const declaresPeer = installed?.peerDependencies != null && Object.hasOwn(Object(installed.peerDependencies), 'eslint');
    if (!request.required && !declaresPeer && !named(installed?.name ?? '')) {
      if (failure) warnings.push(`metadata-unavailable: ${request.name}`);
      continue;
    }
    if (directory) seen.add(directory);
    const unknown = [];
    if (failure) unknown.push('metadata-unavailable: ' + failure);
    if (!semver.valid(installed?.version)) unknown.push('missing-or-invalid-version');
    const peerRange = typeof peer === 'string' ? peer : null;
    const validRange = peerRange !== null && semver.validRange(peerRange) !== null;
    const acceptsTarget = validRange ? semver.satisfies(target, peerRange) : null;
    if (!validRange) unknown.push(peer === undefined ? 'eslint-peer-absent' : 'eslint-peer-invalid');
    const result = directory && installed ? await scan(directory) : { findings: [], coverage: { files: 0, bytes: 0, omitted: [], errors: [] } };
    if (result.coverage.errors.length) unknown.push('incomplete-scan');
    const statuses = [];
    if (acceptsTarget === false) statuses.push('peer-blocked');
    if (result.findings.length) statuses.push('api-candidate');
    if (unknown.length) statuses.push('unknown');
    if (!statuses.length) statuses.push('no-static-blockers-found');
    packages.push({ name: request.name, version: installed?.version ?? null, installedPath: directory ? slash(path.relative(root, directory)) : null, peerRange, acceptsTarget, statuses, unknown, ...result });
    if (installed) {
      for (const name of dependencyNames(installed)) queue.push({ name, from: directory, required: named(name) });
    }
  }
  packages.sort((a, b) => a.name.localeCompare(b.name, 'en') || (a.installedPath ?? '').localeCompare(b.installedPath ?? '', 'en'));
  if (!packages.length) warnings.push('no-eslint-packages-discovered');
  const blocked = packages.some(pkg => pkg.statuses.includes('peer-blocked') || pkg.statuses.includes('api-candidate'));
  const unknown = warnings.length > 0 || packages.some(pkg => pkg.statuses.includes('unknown'));
  return { schemaVersion: 1, target, ruleset: migration.id, source: migration.source, limits, packages, warnings, exitCode: blocked ? 1 : unknown ? 2 : 0, disclaimer: 'Static evidence only. No result certifies runtime compatibility.' };
}
