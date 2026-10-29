# lintpreflight

Find installed ESLint 10 upgrade blockers before changing your project, with package, file and line evidence.

[![CI](https://github.com/itzjk/lintpreflight/actions/workflows/ci.yml/badge.svg)](https://github.com/itzjk/lintpreflight/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

![A peer blocker and an API candidate, followed by a corrected fixture](docs/demo.gif)

## Quick start

Install with Node.js 20.19 or newer:

```sh
npm i -g git+https://github.com/itzjk/lintpreflight.git
```

Inspect an npm project with its dependencies already installed:

```sh
lintpreflight --target 10 ./your-project
```

## Features

- See installed versions and whether each declared ESLint peer accepts your exact target.
- Open package-relative file and line evidence for removed API candidates.
- Distinguish a peer rejection from code that deserves runtime investigation.
- Feed stable JSON and documented exit codes into CI.
- Inspect locally without loading plugins, evaluating config, or changing dependencies.

## Why

[eslint-plugin-react #3977](https://github.com/jsx-eslint/eslint-plugin-react/issues/3977) documents a real ESLint 10 crash on `contextOrFilename.getFilename()`. Its 357 thumbs-up reactions were recorded on October 28, 2026; they show demand for plugin compatibility, rather than validation of this tool. Widening a peer range alone cannot establish runtime compatibility, so lintpreflight puts the declared range beside evidence from the installed code.

## How it works

lintpreflight reads the project's package.json and installed package metadata, discovers ESLint plugins, parsers and configs, then parses their JavaScript with Acorn. It checks semver peers against a precise target and matches static member accesses against a [versioned API table](lib/eslint10.mjs) sourced from the [official ESLint 10 migration guide](https://eslint.org/docs/latest/use/migrate-to-10.0.0). It never imports inspected code, loads eslint.config.js, installs packages, or contacts a service. Discovery follows dependencies of identified packages within the project; it does not evaluate which rules your configuration enables.

## Usage

| Argument | Meaning |
| --- | --- |
| `--target 10` | Check exactly `10.0.0` |
| `--target 10.2.1` | Check that precise stable ESLint 10 release |
| `--json` | Emit JSON schema version 1 on stdout |
| `<project>` | Path to one installed npm project; quote paths containing spaces |
| `--help` | Print syntax and exit codes |

A package can carry multiple statuses: `peer-blocked`, `api-candidate`, and `unknown`. `no-static-blockers-found` means only that these checks found nothing in the scanned subset. **It does not certify runtime compatibility.** Review candidates and test your actual rules before upgrading.

Exit codes are `0` for no static blockers found, `1` for peer blockers or API candidates, `2` for unknown information or incomplete coverage without a blocker, and `3` for invalid input. Blockers take precedence over unknowns; JSON retains both. See [the report contract](docs/analysis.md) for fields and coverage policy.

## FAQ

**Does a compatible peer mean the plugin works?** No. The demo's second plugin accepts v10 while still calling a removed method. The corrected fixture only demonstrates that these particular findings disappear.

**Does it change my project?** Inspection reads metadata and source files only. It does not edit package.json, lockfiles, node_modules, or config. The tests check hashes and include code that would write a marker if executed.

**Does it replace other migration tools?** No. [check-peer-dependencies](https://github.com/christopherthielen/check-peer-dependencies) checks peer constraints, [npm-check-updates](https://github.com/raineorshine/npm-check-updates) selects upgrades, and [official codemods](https://eslint.org/blog/2026/07/eslint-codemod-migrations/) rewrite code. [eslint-plugin-compat](https://github.com/amilajack/eslint-plugin-compat) checks browser APIs. This report helps decide what to investigate first.

## Limitations

- One npm project with a stable installed tree. Workspace links and symlinked packages are reported as unknown.
- Ten removed context/SourceCode members, not every ESLint breaking change.
- JavaScript ESM/CJS only. Unsupported syntax, unreadable files and limits create coverage gaps.
- Static names include ambiguous receivers and simple aliases. Dynamic property names, interprocedural flow and actual execution paths are outside scope.
- Tests, fixtures, docs, examples and minified bundles are excluded and listed. Traversal and byte limits are explicit in every report.

## Contributing

From a clone, run `npm ci --ignore-scripts` and `npm test`. Install that clone with `npm i -g .`. See [development checks](docs/development.md) for mutation tests, the public package check and demo recording.

## License

[MIT](LICENSE).
