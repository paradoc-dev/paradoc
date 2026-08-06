# Changelog

All notable changes to Paradoc. Packages are versioned in lockstep.

## [Unreleased]

## [0.4.0] - 2026-08-06

### Changed
- Form rendering and sealing use the built-in MIME-selected renderer by default while preserving custom renderer overrides. The CLI and integrations use the same unified renderer.
- The current schema version is `2026-08-06`; the published `2026-01-01` schemas remain available unchanged.

### Added
- `@paradoc/render`, a dependency-light renderer for text, Markdown, HTML, PDF, and DOCX layers, including template control flow, PDF AcroForm filling, overlays, inspection, page selection, and flattening.
- Recursive List fields across builders, types, schemas, validation, serialization, and rendering.
- A sealing boundary with local PDF flattening and optional adapters for non-PDF conversion.

### Removed
- The legacy `@paradoc/renderers`, `@paradoc/renderer-text`, `@paradoc/renderer-pdf`, and `@paradoc/renderer-docx` packages.
- Heavy PDF, DOCX templating, and Handlebars dependencies from the rendering and e-signing paths.

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
