# Validation record

Local checks completed October 28, 2026, America/New_York. The public package check uses UTC dates and is recorded as October 29 in public-check.json. Runtime: Node.js 24.16.0, npm 11.13.0, macOS.

| Check | Observed result |
| --- | --- |
| npm ci --ignore-scripts in a clean local Git clone | Passed, two dependencies |
| npm test in that clone | 39 passed, 0 failed, 0 skipped |
| npm run test:mutations | Three mutations killed |
| npm i -g . using a temporary prefix | Passed; installed CLI returned 1 for before, 0 for after |
| Packaged tarball installation, independent review | Passed; corrected code and test hashes matched |
| npm run test:public | Passed against published eslint-plugin-react@7.37.5 |
| vhs validate docs/demo.tape | Passed |
| GIF inspected at before and after frames | 11.24 seconds, both reports visible |
| README length | 630 whitespace-delimited words |
| git diff --check | Passed |

The public package contained 51 candidates across 136 scanned JavaScript files. Its peer excludes ESLint 10. The reported issue pattern is at lib/util/version.js:31:82 with receiver contextOrFilename. Exact tarball integrity and finding data are in [public-check.json](public-check.json). The check inspects the published plugin tarball without installing its transitive dependencies, so this verifies the pattern rather than a complete runtime installation.

The mutation harness disables the detector, treats an accepting peer as sufficient to skip scanning, and changes discovery to ignore empty peers. Each causes its targeted regression test to fail. Hash tests cover project contents, including package.json and installed source; trap plugin and config code leave no execution marker. Independent review additionally exercised FIFO metadata/source paths and found no hangs.

Independent review found an empty-peer discovery bug during development. The corrected implementation recognizes declaration presence rather than truthiness. Four regressions cover empty, null, false and numeric peer values. The final independent review approved the corrected local scope with 39 passing tests and all three mutations killed.

# Pending environment checks

Remote GitHub installation was attempted using the README command. It failed during Git transport with exit 128 and an SSH authentication error in this environment. The repository has not been published, so remote installation remains unverified. Hosted CI also remains unverified until publication and its first run. Local clone and tarball installations succeeded.

The working repository's .git directory is read-only in this environment. Staging and committing failed with `index.lock: Operation not permitted`; source files remain uncommitted here. No push or publication was attempted.

The weakest remaining assumption is discovery coverage: packages without recognizable names or ESLint peer metadata can hide helper code outside the scan. Static findings do not establish that a branch runs, and a clean report never establishes runtime compatibility.
