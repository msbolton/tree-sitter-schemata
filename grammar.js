/**
 * Schemata grammar for tree-sitter. Mirrors the parser rules of the compiler's ANTLR grammar.
 */
/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const KEYWORDS = [
  'schema', 'import', 'as', 'model', 'enum', 'union', 'alias', 'reserved',
  'true', 'false', 'service', 'operation', 'stream',
];

/** One or more of `rule`, separated by commas. */
function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}

/** What may follow a type: `?` for a nullable element, then `[]` (optionally `?`) for a list. */
function typeSuffix($) {
  return seq(optional($.nullable), optional($.list_suffix));
}

module.exports = grammar({
  name: 'schemata',

  extras: $ => [/\s/, $.comment],

  word: $ => $.identifier,

  conflicts: $ => [
    [$.source_file, $.model_declaration, $.enum_declaration, $.union_declaration, $.alias_declaration, $.service_declaration],
    [$.model_declaration, $.model_body, $.field, $.enum_declaration, $.union_declaration, $.alias_declaration],
    [$.enum_body, $.enum_value],
    // An identifier after an operation's signature is a binding verb or the next operation's
    // name; the token after it (a string or `(`) decides.
    [$.operation],
  ],

  rules: {
    // The schema line is optional here although the compiler requires it: a file whose first line
    // is missing or mistyped still parses its declarations, so it keeps its highlighting while the
    // server reports the missing header. Leading docs belong to the file only when a schema line
    // follows; otherwise they lead the first declaration.
    source_file: $ => seq(
      optional(seq(optional($._docs), $.schema_declaration)),
      repeat($.import_declaration),
      repeat(choice($._declaration, $.service_declaration, $.future_declaration)),
      optional($._stray_docs),
    ),

    // The header's attributes follow its name. They are read greedily, as the compiler reads
    // them, so an attribute on a later line above the first declaration lands here too; a doc
    // comment ends the header.
    schema_declaration: $ => prec.right(seq(
      'schema',
      field('name', $.qualified_name),
      optional($._attributes),
    )),

    import_declaration: $ => seq(
      'import',
      field('schema', $.qualified_name),
      optional(seq('as', field('alias', $.identifier))),
    ),

    qualified_name: $ => seq($.identifier, repeat(seq('.', $.identifier))),

    _declaration: $ => choice(
      $.model_declaration,
      $.enum_declaration,
      $.union_declaration,
      $.alias_declaration,
    ),

    // Doc comments and attributes lead every element that takes them. They are shared hidden
    // rules so the parser need not know which element follows until it reaches the keyword.
    _docs: $ => repeat1($.doc_comment),
    _attributes: $ => repeat1($.attribute),

    // A `///` line with no element after it (last in a body or in the file) is not a doc comment
    // for anything; it reads as a plain comment.
    _stray_docs: $ => repeat1(alias($.doc_comment, $.comment)),

    model_declaration: $ => seq(
      optional($._docs),
      optional($._attributes),
      'model',
      field('name', $.identifier),
      field('body', $.model_body),
    ),

    // Block attributes (`@@x`) close a body and belong to its model or inline shape.
    model_body: $ => seq(
      '{',
      repeat(choice($.field, $._declaration, $.reserved_statement)),
      repeat($.block_attribute),
      optional($._stray_docs),
      '}',
    ),

    // `[#n] name Type [{ options }] [@attributes] [= default]`. Attributes after the type are read
    // greedily: the compiler hands those on a later line to the next member, which only a line
    // count can tell, so here they all stay on the field.
    field: $ => prec.right(seq(
      optional($._docs),
      optional($._attributes),
      optional(field('ordinal', $.ordinal)),
      field('name', $.identifier),
      field('type', choice($.type, $.inline_enum, $.inline_shape)),
      optional(field('options', $.option_block)),
      optional($._attributes),
      optional(seq('=', field('default', $._literal))),
    )),

    enum_declaration: $ => seq(
      optional($._docs),
      optional($._attributes),
      'enum',
      field('name', $.identifier),
      field('body', $.enum_body),
    ),

    // Commas between values are optional.
    enum_body: $ => seq(
      '{',
      repeat(seq($.enum_value, optional(','))),
      repeat($.reserved_statement),
      optional($._stray_docs),
      '}',
    ),

    enum_value: $ => seq(
      optional($._docs),
      optional($._attributes),
      optional(field('ordinal', $.ordinal)),
      field('name', $.identifier),
    ),

    union_declaration: $ => seq(
      optional($._docs),
      optional($._attributes),
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
      optional(field('options', $.option_block)),
    ),

    alias_declaration: $ => seq(
      optional($._docs),
      optional($._attributes),
      'alias',
      field('name', $.identifier),
      '=',
      field('type', $.type),
      optional(field('options', $.option_block)),
    ),

    reserved_statement: $ => seq(
      'reserved',
      commaSep1(choice($.ordinal_range, $.ordinal, $.string)),
    ),

    ordinal_range: $ => seq($.ordinal, '..', $.ordinal),

    service_declaration: $ => seq(
      optional($._docs),
      optional($._attributes),
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
      optional($._attributes),
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

    // `operation` is reserved for a later version of the language at the top level; the body is
    // skipped as balanced braces.
    future_declaration: $ => seq(
      'operation',
      optional($.identifier),
      optional($.block),
    ),

    block: $ => seq('{', repeat(choice($.block, $.string, $._block_text)), '}'),

    _block_text: _ => token(prec(-1, /[^{}"\s]+/)),

    // A named type: `name`, `name<args>`, or `decimal(19, 4)`, then `?` for a nullable element
    // and `[]` (optionally `?`) for a list of it.
    type: $ => seq(
      field('name', $.qualified_name),
      optional(field('arguments', $.type_arguments)),
      optional(field('precision', $.decimal_arguments)),
      typeSuffix($),
    ),

    // Only a field's type may be an inline enum or shape, directly or as a list's element. After
    // a field's name the first `{ … }` is an inline shape; the one after a type is its options.
    inline_enum: $ => seq('enum', field('body', $.enum_body), typeSuffix($)),

    inline_shape: $ => seq(field('body', $.model_body), typeSuffix($)),

    nullable: _ => '?',

    list_suffix: $ => seq('[', ']', optional($.nullable)),

    // Options on a type argument constrain a map's key or value.
    type_arguments: $ => seq(
      '<',
      commaSep1(seq($.type, optional(field('options', $.option_block)))),
      '>',
    ),

    decimal_arguments: $ => seq('(', $.integer, ',', $.integer, ')'),

    // Option names are plain identifiers, so `index int32 { index }` reads. A value is a number,
    // a string, or a boolean but never a bare name: `{ id unique }` is two flags.
    option_block: $ => seq('{', $.option, repeat(seq(optional(','), $.option)), '}'),

    option: $ => seq(
      field('name', $.identifier),
      optional(field('value', choice($.integer, $.float, $.string, $.boolean))),
    ),

    // A target's key vocabulary is its own, so a reserved word reads as an attribute name or key
    // (`@sql(schema: "shop")`).
    attribute: $ => seq('@', field('name', $._attribute_name), optional($._attribute_arguments)),

    block_attribute: $ => seq('@@', field('name', $._attribute_name), optional($._attribute_arguments)),

    _attribute_name: $ => choice($.identifier, alias(choice(...KEYWORDS), $.identifier)),

    _attribute_arguments: $ => seq('(', optional(commaSep1($.attribute_argument)), ')'),

    attribute_argument: $ => choice(
      seq(
        field('key', $._attribute_name),
        ':',
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
