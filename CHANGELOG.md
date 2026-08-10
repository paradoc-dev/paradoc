# Changelog

All notable changes to Paradoc. Packages are versioned in lockstep.

## [Unreleased]

## [0.5.0] - 2026-08-10

### Added

- Unified `signatures` slot map on layers. Each slot binds a party to a placement: `'auto'` (an invisible marker injected at render time and located after conversion), a text `anchor` (unique in the document, or selected with `occurrence`), or absolute coordinates. One placement engine resolves all three, and misconfiguration fails before rendering with a `SealConfigError` naming every problem. Legacy `signatureBlocks`/`anchorBlocks` still parse and seal unchanged.
- A built-in placement locator in `@paradoc/render`: a dependency-light PDF text scanner (`locate`, `extractFieldsFromPdf`, `pageTextRuns`, marker encoding) that resolves signature positions in converted PDFs without a PDF rendering engine. Exported from `@paradoc/render/pdf` and re-exported by `@paradoc/sdk`.
- `prepareSeal()` on draft forms: resolves the signature map and returns the exact pre-flatten PDF it describes, with per-field provenance (`declared` | `anchor` | `marker`) and warnings, without changing the form's phase.
- `SealOptions.locate` to substitute a custom placement locator.
- The schema version `2026-08-10` adds the `SignatureSlot` layer schema; the published `2026-08-06` schemas remain available unchanged.

### Changed

- Anchor-based sealing works with pure byte converters, including `hostedSealAdapter`, with zero configuration: core locates anchor text itself in the converted PDF. Adapters that resolve placements themselves still take precedence.
- The sealing guide is rewritten around signature slots, placement strategies, and pure converters.

### Fixed

- `PdfModel` resolves indirect `/Length` stream references, so PDFs written by LibreOffice no longer lose trailing stream bytes.

### Removed

- The unused `SealingRequest.options` block (`renderer`, `format`). It was never read by any implementation.

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
