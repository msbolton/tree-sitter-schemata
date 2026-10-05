/**
 * Schemata grammar for tree-sitter. Mirrors the parser rules of the compiler's ANTLR grammar.
 */
/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const KEYWORDS = [
  'namespace', 'import', 'as', 'record', 'enum', 'union', 'alias', 'reserved',
  'true', 'false', 'service', 'operation', 'stream',
];

/** One or more of `rule`, separated by commas. */
function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}

module.exports = grammar({
  name: 'schemata',

  extras: $ => [/\s/, $.comment],

  word: $ => $.identifier,

  conflicts: $ => [
    [$.source_file, $.record_declaration, $.enum_declaration, $.union_declaration, $.alias_declaration, $.service_declaration],
    [$.enum_body, $.enum_value],
    // An identifier after an operation's signature is a binding verb or the next operation's
    // name; the token after it (a string or `(`) decides.
    [$.operation],
    [$.record_declaration, $.record_body, $.field, $.enum_declaration, $.union_declaration, $.alias_declaration],
  ],

  rules: {
    // The namespace line is optional here although the compiler requires it: a file whose first
    // line is missing or mistyped still parses its declarations, so it keeps its highlighting while
    // the server reports the missing namespace. Leading docs and annotations belong to the
    // namespace only when one follows; otherwise they lead the first declaration.
    source_file: $ => seq(
      optional(seq(optional($._docs), optional($._annotations), $.namespace_declaration)),
      repeat($.import_declaration),
      repeat(choice($._declaration, $.service_declaration, $.future_declaration)),
      optional($._stray_docs),
    ),

    namespace_declaration: $ => seq('namespace', field('name', $.qualified_name)),

    import_declaration: $ => seq(
      'import',
      field('namespace', $.qualified_name),
      optional(seq('as', field('alias', $.identifier))),
    ),

    qualified_name: $ => seq($.identifier, repeat(seq('.', $.identifier))),

    _declaration: $ => choice(
      $.record_declaration,
      $.enum_declaration,
      $.union_declaration,
      $.alias_declaration,
    ),

    // Doc comments and annotations lead every element that takes them. They are shared hidden
    // rules so the parser need not know which element follows until it reaches the keyword.
    _docs: $ => repeat1($.doc_comment),
    _annotations: $ => repeat1($.annotation),

    // A `///` line with no element after it (last in a body or in the file) is not a doc comment
    // for anything; it reads as a plain comment.
    _stray_docs: $ => repeat1(alias($.doc_comment, $.comment)),

    record_declaration: $ => seq(
      optional($._docs),
      optional($._annotations),
      'record',
      field('name', $.identifier),
      field('body', $.record_body),
    ),

    record_body: $ => seq(
      '{',
      repeat(choice($.field, $._declaration, $.reserved_statement)),
      optional($._stray_docs),
      '}',
    ),

    field: $ => seq(
      optional($._docs),
      optional($._annotations),
      optional(field('ordinal', $.ordinal)),
      field('name', $.identifier),
      ':',
      field('type', $.type),
      optional(seq('=', field('default', $._literal))),
    ),

    enum_declaration: $ => seq(
      optional($._docs),
      optional($._annotations),
      'enum',
      field('name', $.identifier),
      field('body', $.enum_body),
    ),

    enum_body: $ => seq(
      '{',
      repeat(seq($.enum_value, optional(','))),
      repeat($.reserved_statement),
      optional($._stray_docs),
      '}',
    ),

    enum_value: $ => seq(
      optional($._docs),
      optional($._annotations),
      optional(field('ordinal', $.ordinal)),
      field('name', $.identifier),
    ),

    union_declaration: $ => seq(
      optional($._docs),
      optional($._annotations),
      'union',
      field('name', $.identifier),
      '=',
      $.union_member,
      repeat(seq('|', $.union_member)),
    ),

    union_member: $ => seq(
      optional($._docs),
      optional(field('ordinal', $.ordinal)),
      field('type', $.type),
    ),

    alias_declaration: $ => seq(
      optional($._docs),
      optional($._annotations),
      'alias',
      field('name', $.identifier),
      '=',
      field('type', $.type),
    ),

    reserved_statement: $ => seq(
      'reserved',
      commaSep1(choice($.ordinal_range, $.ordinal, $.string)),
    ),

    ordinal_range: $ => seq($.ordinal, '..', $.ordinal),

    service_declaration: $ => seq(
      optional($._docs),
      optional($._annotations),
      'service',
      field('name', $.identifier),
      field('body', $.service_body),
    ),

    service_body: $ => seq(
      '{',
      repeat(choice($.operation, $.reserved_statement)),
      optional($._stray_docs),
      '}',
    ),

    operation: $ => seq(
      optional($._docs),
      optional($._annotations),
      optional(field('ordinal', $.ordinal)),
      field('name', $.identifier),
      '(',
      optional(field('request', $.payload)),
      ')',
      optional(seq(':', field('response', $.payload))),
      optional(field('binding', $.http_binding)),
    ),

    payload: $ => seq(optional('stream'), field('type', $.type)),

    // The verb is an identifier rather than a keyword, so `get` and `post` stay legal names
    // elsewhere; the compiler checks it against the HTTP methods.
    http_binding: $ => seq(field('verb', $.identifier), field('path', $.string)),

    // `operation` and `stream` are reserved for a later version of the language at the top level;
    // the body is skipped as balanced braces.
    future_declaration: $ => seq(
      choice('operation', 'stream'),
      optional($.identifier),
      optional($.block),
    ),

    block: $ => seq('{', repeat(choice($.block, $.string, $._block_text)), '}'),

    _block_text: _ => token(prec(-1, /[^{}"\s]+/)),

    type: $ => seq(
      field('name', $.qualified_name),
      optional(field('arguments', $.type_arguments)),
      optional(field('refinements', $.refinements)),
      optional('?'),
    ),

    type_arguments: $ => seq('<', commaSep1($.type), '>'),

    refinements: $ => seq('(', commaSep1($.refinement), ')'),

    refinement: $ => choice(
      seq(field('key', $.identifier), '=', field('value', $._literal)),
      field('value', $._literal),
    ),

    annotation: $ => seq(
      '@',
      field('name', $.identifier),
      optional(seq('(', optional(commaSep1($.annotation_argument)), ')')),
    ),

    annotation_argument: $ => choice(
      seq(
        field('key', choice($.identifier, alias(choice(...KEYWORDS), $.identifier))),
        '=',
        field('value', choice($._literal, $.name_tuple)),
      ),
      field('value', $._literal),
    ),

    name_tuple: $ => seq('(', commaSep1($.identifier), ')'),

    _literal: $ => choice($.integer, $.float, $.string, $.boolean, $.identifier),

    boolean: _ => choice('true', 'false'),

    identifier: _ => /[A-Za-z_][A-Za-z0-9_]*/,

    ordinal: _ => /#[0-9]+/,

    float: _ => /-?[0-9]+\.[0-9]+/,

    integer: _ => /-?[0-9]+/,

    string: $ => seq(
      '"',
      repeat(choice($._string_content, $.escape_sequence)),
      token.immediate('"'),
    ),

    _string_content: _ => token.immediate(prec(1, /[^"\\\r\n]+/)),

    escape_sequence: _ => token.immediate(/\\[^\r\n]/),

    // Both a doc comment and a line comment match a whole `/// …` line; the doc comment wins where
    // the grammar allows one, and elsewhere the line reads as a plain comment.
    doc_comment: _ => token(prec(1, /\/\/\/[^\r\n]*/)),

    comment: _ => token(choice(
      /\/\/[^\r\n]*/,
      /\/\*[^*]*\*+([^/*][^*]*\*+)*\//,
    )),
  },
});
