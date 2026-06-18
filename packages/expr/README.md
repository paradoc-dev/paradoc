# @paradoc/expr

A purpose-built expression language for Paradoc artifacts. It owns one typed AST
consumed by both an evaluator and an artifact-aware checker, so authoring-time
type checking and runtime evaluation never disagree.

Scope is intra-artifact logic only: field and section visibility, required,
defs, validation rules, and payment amounts. It is a boolean and value
expression language, not a flow, routing, or form-selection language.

See `_docs/plans/paradoc-expr/` in the workspace for the design and the
`language-spec.md` for the full type system, operators, functions, and
robustness requirements.

## Status

Built in phases:

1. Shared types, typed AST, grammar config, function registry. (current)
2. Parser.
3. Evaluator (exact decimal, temporal, null-safe).
4. Artifact-aware checker (`check(expr, schema) -> Diagnostic[]`).

## Layout

- `src/types.ts` — spans, the `ExprType` system, diagnostics.
- `src/ast/nodes.ts` — the typed AST.
- `src/grammar/` — pure-data grammar config and the EBNF (`GRAMMAR.md`).
- `src/registry/` — the function registry, single source of truth for both
  evaluator and checker.
