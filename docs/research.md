# Scope and prior art

Consulted October 28, 2026. This was a bounded search, not an exhaustive claim of absence.

Queries: `"eslint 10" "preflight" plugins compatibility`, `eslint installed plugins removed context APIs compatibility checker`, and `site:github.com eslint migration compatibility scanner peer dependencies`.

Reviewed primary project pages:

- https://github.com/amilajack/eslint-plugin-compat: browser API compatibility for application source.
- https://github.com/christopherthielen/check-peer-dependencies: declared peer constraints and resolution advice.
- https://github.com/raineorshine/npm-check-updates: dependency version selection and package.json updates.
- https://eslint.org/blog/2026/07/eslint-codemod-migrations/: official source transformations, including v9-to-v10 custom rules.

None of these reviewed tools describes the exact combination of installed-package peer checks and read-only API evidence reports. No exact substitute was identified in the bounded search. They remain complementary tools. lintpreflight does not include their source or designs.

The demand signal is https://github.com/jsx-eslint/eslint-plugin-react/issues/3977. The brief recorded 357 thumbs-up reactions on October 28; votes concern compatibility upstream, not willingness to adopt this product. The issue documents contextOrFilename.getFilename failing during rule loading.

Technical source: https://eslint.org/docs/latest/use/migrate-to-10.0.0, consulted October 28, 2026. The context and SourceCode removal sections define the supported subset and replacements. The versioned module is the sole detector table.
