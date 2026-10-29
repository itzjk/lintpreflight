# Validation record

Local checks completed October 28, 2026, America/New_York. The public package check uses UTC dates and is recorded as October 29 in public-check.json. Runtime: Node.js 24.16.0, npm 11.13.0, macOS.

| Check | Observed result |
| --- | --- |
| npm ci --ignore-scripts in a clean local Git clone | Passed, two dependencies |
| npm test in that clone | 46 passed, 0 failed, 0 skipped |
| npm run test:mutations | Five mutations killed |
| npm i -g . using a temporary prefix | Passed; installed CLI returned 1 for before, 0 for after |
| Retained acceptance cases, using the corrected CLI | 22 matched their expected exits; 5,983 file hashes unchanged |
| Fresh npm installation with paths containing spaces | Two relevant packages, zero discovery warnings, exit 1 for React |
| npm run test:public | Passed against published eslint-plugin-react@7.37.5 |
| vhs validate docs/demo.tape | Passed |
| GIF inspected at before and after frames | 11.24 seconds, both reports visible |
| README length | 643 whitespace-delimited words |
| git diff --check | Passed |

The public package contained 51 candidates across 136 scanned JavaScript files. Its peer excludes ESLint 10. The reported issue pattern is at lib/util/version.js:31:82 with receiver contextOrFilename. Exact tarball integrity and finding data are in [public-check.json](public-check.json). The check inspects the published plugin tarball without installing its transitive dependencies, so this verifies the pattern rather than a complete runtime installation.

The mutation harness disables the detector, treats an accepting peer as sufficient to skip scanning, changes discovery to ignore empty peers, includes plugin authors' devDependencies, and excludes the project's devDependencies. Each causes its targeted regression test to fail. Hash tests cover project contents, including package.json and installed source; trap plugin and config code leave no execution marker.

The acceptance review rejected the initial discovery scope: an installed plugin's author-only devDependencies produced phantom packages, warnings and exit 2 for an otherwise clean project. Discovery now includes devDependencies only at the project root. The retained control and author-devDependency cases produce identical JSON, exit 0, one package and no warnings. Seven new regression cases cover missing and installed author-only tools, discovery-budget pollution, project devDependencies, nested and hoisted runtime dependencies, and missing runtime metadata. Before the fix, five of those seven tests failed.

A fresh installation used eslint@9.39.5, @eslint/js@9.39.5 and eslint-plugin-react@7.37.5. Inspection reported only @eslint/js and eslint-plugin-react, with no discovery warnings or phantom author packages. React retained both blocker statuses and all 51 candidates. The content hashes of 5,948 installed and project files were unchanged. @eslint/js remains unknown because its metadata has no ESLint peer; the correction does not suppress legitimate unknown information.

The clean-clone check used a temporary local Git snapshot containing the correction, followed by a fresh clone and dependency installation. Its working tree remained clean after tests and local installation. Independent review during initial development checked the earlier scope and found an empty-peer bug; that earlier approval does not cover this correction.

# Pending environment checks

Remote GitHub installation was attempted using the README command. It failed during Git transport with exit 128 and an SSH authentication error in this environment. The repository has not been published, so remote installation remains unverified. Hosted CI also remains unverified until publication and its first run. Local clone and tarball installations succeeded.

Independent review of this correction remains pending. The delegation service failed to initialize; the alternative local reviewer could not authenticate. Neither attempt produced a review, so no independent approval is claimed for this round.

The working repository's .git directory is read-only in this environment. Staging failed with `index.lock: Operation not permitted`; source files remain uncommitted here. No push or publication was attempted.

The weakest remaining assumption is discovery coverage: packages without recognizable names or ESLint peer metadata can hide helper code outside the scan. Static findings do not establish that a branch runs, and a clean report never establishes runtime compatibility.
