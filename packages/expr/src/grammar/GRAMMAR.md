# @paradoc/expr grammar (EBNF)

A single expression. Whitespace is insignificant between tokens. The start
symbol is `expression`.

```ebnf
expression   = ternary ;

ternary      = logic_or [ "?" expression ":" expression ] ;

logic_or     = logic_and { "or" logic_and } ;
logic_and    = membership { "and" membership } ;

membership   = equality [ ( "in" | "not" "in" ) equality ] ;

equality     = comparison { ( "==" | "!=" ) comparison } ;
comparison   = additive { ( "<" | "<=" | ">" | ">=" ) additive } ;

additive     = multiplicative { ( "+" | "-" ) multiplicative } ;
multiplicative = unary { ( "*" | "/" | "%" ) unary } ;

unary        = ( "not" | "!" | "-" ) unary | postfix ;

postfix      = primary { "." identifier | "[" expression "]" } ;

primary      = number
             | string
             | "true" | "false"
             | "null"
             | identifier [ "(" [ arguments ] ")" ]   (* call if parens follow *)
             | array
             | "(" expression ")" ;

arguments    = expression { "," expression } ;
array        = "[" [ expression { "," expression } ] "]" ;

identifier   = ( letter | "_" ) { letter | digit | "_" } ;
number       = digit { digit } [ "." digit { digit } ] ;
string       = '"' { character } '"' | "'" { character } "'" ;
```

Notes:

- `+` is polymorphic: numeric addition or string concatenation, resolved by
  operand type during checking and evaluation.
- `not in` is the negated membership operator.
- A bare `identifier` is a reference (defs key or context root such as
  `fields`); an `identifier` immediately followed by `(` is a function call.
  Functions are not first-class values.
- `[index]` postfix is reserved; it is not an author surface in v1 (only array
  literals for `in [..]` are exercised).
- Deliberately absent: `=` assignment, lambdas, `&&` / `||`, and any
  non-deterministic builtin. These are reported as errors by the checker.
