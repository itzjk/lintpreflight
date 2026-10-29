#!/usr/bin/env node
import { inspect, InputError } from '../lib/inspect.mjs';

const help = `lintpreflight --target 10|10.x.y [--json] <project>
Inspect installed ESLint packages without loading their code.
Exit: 0 no static blockers found, 1 peer/API candidates, 2 unknown, 3 invalid input.
--target 10 means exactly 10.0.0. Only stable ESLint 10 targets are supported.`;
const args = process.argv.slice(2);
const json = args.includes('--json');
try {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log(help);
  } else {
    let target;
    let project;
    let jsonSeen = false;
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--target' && target === undefined) target = args[++i];
      else if (arg === '--json' && !jsonSeen) jsonSeen = true;
      else if (!arg.startsWith('-') && project === undefined) project = arg;
      else throw new InputError('Unknown or duplicate argument. ' + help);
    }
    if (!target || !project) throw new InputError(help);
    const report = await inspect(project, target);
    if (json) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`lintpreflight | ESLint ${report.target}\n`);
      for (const pkg of report.packages) {
        console.log(`${pkg.name}@${pkg.version ?? '?'}  [${pkg.statuses.join(', ')}]`);
        console.log(`  installed: ${pkg.installedPath ?? 'unresolved'}`);
        console.log(`  peer eslint: ${pkg.peerRange ?? 'unknown'} | accepts target: ${pkg.acceptsTarget ?? 'unknown'}`);
        for (const item of pkg.findings) console.log(`  ${item.file}:${item.line}:${item.column}  ${item.api} (${item.kind}, candidate)\n    replacement: ${item.replacement}`);
        console.log(`  scan: ${pkg.coverage.files} JS files; ${pkg.coverage.omitted.length} omitted; ${pkg.coverage.errors.length} coverage gaps`);
        for (const reason of pkg.unknown) console.log(`  unknown: ${reason}`);
        for (const item of [...pkg.coverage.errors, ...pkg.coverage.omitted]) console.log(`  omitted: ${item.file} (${item.reason})`);
        console.log('');
      }
      for (const warning of report.warnings) console.log(`unknown: ${warning}`);
      console.log(`${report.disclaimer}\nExit ${report.exitCode} | API reference: ${report.source}`);
    }
    process.exitCode = report.exitCode;
  }
} catch (error) {
  const message = error instanceof InputError ? error.message : 'Inspection failed: ' + (error.code ?? 'unexpected-error');
  if (json) console.log(JSON.stringify({ schemaVersion: 1, error: message, exitCode: 3 }));
  else console.error(message);
  process.exitCode = 3;
}
