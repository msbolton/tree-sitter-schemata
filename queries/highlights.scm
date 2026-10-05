; Sibling of languages/schemata/highlights.scm in https://github.com/msbolton/zed-schemata; carry a fix to both.
; Comments
(comment) @comment
(doc_comment) @comment.documentation

; Keywords
[
  "namespace"
  "import"
  "as"
  "record"
  "enum"
  "union"
  "alias"
  "reserved"
  "service"
  "operation"
  "stream"
] @keyword

; Literals
(boolean) @boolean
(integer) @number
(float) @number
(string) @string
(escape_sequence) @string.escape
(ordinal) @constant

; Namespaces
(namespace_declaration name: (qualified_name (identifier) @module))
(import_declaration namespace: (qualified_name (identifier) @module))
(import_declaration alias: (identifier) @module)

; Declared names
(record_declaration name: (identifier) @type)
(enum_declaration name: (identifier) @type)
(union_declaration name: (identifier) @type)
(alias_declaration name: (identifier) @type)
(field name: (identifier) @property)
(enum_value name: (identifier) @constant)
(service_declaration name: (identifier) @type)
(operation name: (identifier) @function)

; HTTP bindings
(http_binding verb: (identifier) @keyword)

; Type references
(type name: (qualified_name (identifier) @type))
((type name: (qualified_name . (identifier) @type.builtin .))
  (#match? @type.builtin "^(bool|int32|int64|float32|float64|decimal|string|bytes|uuid|date|time|instant|duration|list|map)$"))

; Defaults and refinements
(field default: (identifier) @constant)
(refinement key: (identifier) @property)

; Annotations
(annotation "@" @attribute)
(annotation name: (identifier) @attribute)
(annotation_argument key: (identifier) @property)
(name_tuple (identifier) @property)

; Punctuation
["{" "}" "(" ")" "<" ">"] @punctuation.bracket
["," "." ":"] @punctuation.delimiter
["=" "|" "?" ".."] @operator
