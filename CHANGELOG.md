# Changelog

All notable changes to Paradoc. Packages are versioned in lockstep.

## [Unreleased]

### Added

- `@paradoc/react`: compose a document from React components bound to a form artifact. One tree drives a paginated preview in the browser and a PDF from Node, with the preview's page breaks honored when its plan is passed as hints. The root entry carries the components, the document context and the page plan; `@paradoc/react/pdf` carries `renderPdf`, the adapter seam, the default WebAssembly engine and the seal helpers; `@paradoc/react/chromium` carries the experimental Chromium adapter, whose `puppeteer` and `tailwindcss` peers are optional and whose absence fails with one error naming both. `@paradoc/react/examples` and `@paradoc/react/examples/pdf` carry a worked sample document as sample material rather than API.
- `@paradoc/react`: tenant branding tokens on `Bundle` and `Document`. `fontFamily`, `accentColor`, `pageSize` (`letter` or `a4`) with `marginPx`, and `logo` (bytes or a source string), declared at the document root and layered over by `renderPdf`'s own `tokens` for a per-render override. The resolved set drives both outputs: the paper the preview's sheet is drawn on and the page the engine writes, the faces the browser loads and the engine embeds, the accent on section headings and the emphasised total, and the mark a composition places through `useDocumentTokens()`. Two families are registered, `Inter Variable` and `Source Serif 4 Variable`; naming any other fails with `UnregisteredFontFamilyError` rather than falling back, because a family the engine cannot embed reaches paper as null glyphs. The furniture and `renderPdf` read the tokens off the element with one pure, synchronous `documentTokensOf`, so a static render and the first browser commit are already on the right paper. Paper and typeface are root-only: a nested `Document` that sets them fails with `NestedPaperTokenError`, and a root that resolves a root-only token differently from whatever is drawing it fails with `RootTokenMismatchError` naming the token, on the PDF path as well as in the preview. Every value is checked before a renderer sees it, with `InvalidDocumentTokenError` naming the token. The default token set renders the reference documents byte for byte as before.
- `@paradoc/serialization` registries gain `date`, `datetime`, `time`, `number`, and `percentage` stringifiers, locale-aware through `Intl` with the same fixed options per registry as the existing composite serializers. `@paradoc/render`'s text, DOCX, and PDF field serializer does not yet dispatch these five types, so a date field still emits raw ISO text in those layers; that follow-up is tracked separately.
- React layers by MIME type. A file layer of MIME type `text/tsx` or `text/jsx` names a composition module; an inline layer of either type is rejected at validation with a message naming the rule. MIME types compare without regard to case, so validation and render dispatch read `TEXT/TSX` the same way. `render({ layer, renderers })` selects a renderer from a MIME-keyed registry — on forms, documents and checklists — so `@paradoc/core` dispatches to a React composition without depending on React: `reactLayerRenderers()` from `@paradoc/react/pdf` builds the registry entries, and binds the layer's module from a `components` map keyed by path or layer key, or by importing the path's default export. Import binding executes the module the artifact names, so the path must be relative and resolve inside `baseDir`. A layer that cannot be bound fails naming the path and both options; a React layer with nothing registered fails naming the layer and the option. `reactLayersOf(artifact)` reports which layers an artifact declares that way. `@paradoc/react/examples` declares its composition layer.
- The Zod rule and the JSON Schema keyword it emits land now; the dated schema sets under `@paradoc/schemas` are regenerated at release, so `schema.paradoc.dev` carries the rule from the next one.

### Changed

- `@paradoc/types`: `RendererLayer.content` is optional, because a layer that names its content rather than carrying it — a React composition — has none. `key` and `path` are added, so a renderer that binds a module knows which layer it is rendering. A `FileLayer`'s `path` is documented as relative to the artifact file that declares it, which is what artifacts have always written; it previously said "absolute path from repo root".
- `@paradoc/render`: `renderLayer` fails naming the MIME type when a layer of a type it renders carries no content. An unsupported type is still reported as unsupported.
- `@paradoc/react`: `Pages` decides a repagination from the measurement, not from the identity of its children. It measures again after every render, before paint, and replaces the plan only when the new plan differs, so a host that passes an inline object prop or sets state from `onPaginate` publishes one plan instead of looping, and the sheets that survive an edit keep their DOM nodes.
- The marker-based placement literal is `'flow'` (was `'auto'`): the field sits where the template content places it, mirroring flow/anchored/absolute positioning. Clean rename, no alias; artifacts published with `'auto'` under 0.5.0 must update the literal.
- The bundled essentials forms and example artifacts declare `signatures` slot maps instead of legacy `signatureBlocks`. Legacy blocks remain readable during the deprecation window.

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
