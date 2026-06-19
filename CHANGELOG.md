# Changelog

All notable changes to Paradoc. Packages are versioned in lockstep.

## [0.3.0] - 2026-06-19

### Added
- `@paradoc/expr`: a purpose-built, typed expression language for artifacts — a parser, an evaluator, and an artifact-aware type checker sharing one function registry. Exact-decimal arithmetic (no floating-point drift), temporal types (date, datetime, time, duration), `in` / `not in`, and null-safe access.
- `@paradoc/sessions` is now published: the deterministic, event-sourced form-completion session engine.
- Dependency-aware fill state: a single `status` ordinal (`hidden`, `optional`, `required`), transitive `blockedBy`, and DAG-ordered next-field.
- The expression engine is reachable through `@paradoc/sdk` as the `expr` namespace (`expr.check`, `expr.parse`, `expr.Decimal`).
- Documentation for `@paradoc/sessions` and `@paradoc/expr`, and the fieldset visibility cascade.

### Changed
- Artifact logic now runs on `@paradoc/expr`. A hidden fieldset hides its entire subtree, and a child's required follows its effective visibility.

### Removed
- The `expr-eval-fork` dependency.

## [0.2.0] - 2026-05-19

Earlier release. See the Git history for details.

## [0.1.1] - 2026-05-08
## [0.1.0] - 2026-04-28

Initial public releases.
