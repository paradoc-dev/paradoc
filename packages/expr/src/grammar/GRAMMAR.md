# @paradoc/expr grammar (EBNF)

A single expression. Whitespace is insignificant between tokens. The start
symbol is `expression`.

```ebnf
expression   = ternary ;

ternary      = logic_or [ "?" expression ":" expression ] ;

logic_or     = logic_and { "or" logic_and } ;
logic_and    = equality { "and" equality } ;

equality     = comparison { ( "==" | "!=" ) comparison } ;
comparison   = membership { ( "<" | "<=" | ">" | ">=" ) membership } ;

membership   = additive { ( "in" | "not" "in" ) additive } ;

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
- Binary operators are left-associative. From loosest to tightest: `or`,
  `and`, equality, comparison, membership, additive, multiplicative. So
  `fields.country in ["US"] == fields.ok` compares the membership result, and
  membership chains like any other binary operator.
- `not in` is the negated membership operator. Both words must be keywords:
  `not 'in'` is `not` applied to a string.
- A bare `identifier` is a reference (defs key or context root such as
  `fields`); an `identifier` immediately followed by `(` is a function call.
  Functions are not first-class values.
- `[index]` addresses an array element. Reference analysis marks indexed paths
  as dynamic because their complete dependency cannot always be known statically.
- The aggregates `sum`, `count`, `min`, `max`, `avg`, `any`, and `all` are
  ordinary calls whose first argument is read as a path into a list
  (`sum(fields.items.amount)`) and whose optional second argument is a boolean
  filter over the same rows. They need no grammar of their own.
- Deliberately absent: `=` assignment, lambdas, `map` / `filter` / `reduce`,
  `&&` / `||`, and any non-deterministic builtin. These are reported as errors
  by the checker.
