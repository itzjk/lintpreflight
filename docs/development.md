# Development

Run from the repository root:

```sh
npm ci --ignore-scripts
npm test
npm run test:mutations
npm run test:public
npm run demo:setup
vhs docs/demo.tape
```

The public check downloads exactly eslint-plugin-react@7.37.5 with npm pack --ignore-scripts into a temporary directory. It extracts that published tarball, checks metadata, and asserts the actual contextOrFilename.getFilename call in lib/util/version.js. It executes neither the package nor its dependencies. This is an optional network check, separate from the offline fixture suite. Node and npm are required; tar is needed for this check. The scanner itself performs no network requests.

The demo requires VHS and ffmpeg. The setup script creates synthetic installed npm trees under ignored .demo/before and .demo/after. The peer-only package rejects 10 in before; the other package accepts 10 but calls getFilename. In after, the peer accepts 10 and the method is replaced with filename. The recording runs the real CLI on both trees. The after result does not establish general compatibility.

Mutation checks copy the tool into disposable directories, disable the API detector, skip scanning when a peer accepts the target, or ignore an empty declared peer, and require the corresponding CLI test to fail. They never mutate the working source. Tests also compare SHA-256 contents before and after inspection and check that a trap plugin/config cannot write its marker.

The GitHub install command becomes available once the repository is published. Before publication, packaging can be checked with npm pack and a temporary npm prefix, or a clean local Git clone. CI runs the fixture and mutation suites on Node 20.19, 22 and 24. The hosted CI badge reports the workflow once GitHub runs it; local results are recorded separately.
