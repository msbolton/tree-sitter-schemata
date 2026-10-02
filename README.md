# tree-sitter-schemata

A [tree-sitter](https://tree-sitter.github.io/) grammar for
[Schemata](https://github.com/msbolton/Schemata), the schema language that compiles to Protobuf,
Postgres, XML Schema, and JSON Schema.

The grammar follows the compiler's own parser rule for rule. CI parses every schema file in the
compiler's examples and test suite, at the compiler version named in the workflow, and fails on
any error node, so the two do not drift apart.

## Use

Editors that take a tree-sitter grammar by repository and revision can point at this one. The
[Zed extension](https://github.com/msbolton/zed-schemata) does.

`queries/highlights.scm` holds highlighting captures in the common naming scheme.

## Develop

    npm install
    npx tree-sitter generate     # after changing grammar.js; commit src/
    npx tree-sitter test         # corpus and highlight tests
    scripts/check-compiler-corpus ../Schemata

The generated parser under `src/` is committed, as tree-sitter consumers expect.
