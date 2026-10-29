export const migration = Object.freeze({
  id: 'eslint10-2026-10-28',
  targetMajor: 10,
  source: 'https://eslint.org/docs/latest/use/migrate-to-10.0.0',
  consulted: '2026-10-28',
  members: Object.freeze({
    getCwd: ['context', 'context.cwd', 'method'],
    getFilename: ['context', 'context.filename', 'method'],
    getPhysicalFilename: ['context', 'context.physicalFilename', 'method'],
    getSourceCode: ['context', 'context.sourceCode', 'method'],
    parserOptions: ['context', 'context.languageOptions or context.languageOptions.parserOptions', 'property'],
    parserPath: ['context', 'No replacement', 'property'],
    getTokenOrCommentBefore: ['SourceCode', 'getTokenBefore(nodeOrToken, { includeComments: true, skip })', 'method'],
    getTokenOrCommentAfter: ['SourceCode', 'getTokenAfter(nodeOrToken, { includeComments: true, skip })', 'method'],
    isSpaceBetweenTokens: ['SourceCode', 'isSpaceBetween(first, second)', 'method'],
    getJSDocComment: ['SourceCode', 'No replacement', 'method']
  })
});

export const limits = Object.freeze({ packages: 200, entries: 10000, depth: 20, files: 500, fileBytes: 1048576, packageBytes: 20971520, metadataBytes: 262144 });
export const ignoredDirectories = new Set(['node_modules', '.git', 'test', 'tests', '__tests__', 'fixture', 'fixtures', '__fixtures__', 'docs', 'doc', 'documentation', 'coverage', 'examples', 'example']);
export const javascript = /\.(?:js|cjs|mjs)$/i;
export const ignoredFiles = /(?:^|[.\-_])(?:test|spec)\.(?:js|cjs|mjs)$|\.min\.js$/i;
