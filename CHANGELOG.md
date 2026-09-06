# Changelog

All notable changes to Paradoc. Packages are versioned in lockstep.

## [Unreleased]

### Added

- `@paradoc/react`: compose a document from React components bound to a form artifact. One tree drives a paginated preview in the browser and a PDF from Node, with the preview's page breaks honored when its plan is passed as hints. The root entry carries the components, the document context and the page plan; `@paradoc/react/pdf` carries `renderPdf`, the adapter seam, the default WebAssembly engine and the layer renderer core renders and seals through; `@paradoc/react/chromium` carries the experimental Chromium adapter, whose `puppeteer` and `tailwindcss` peers are optional and whose absence fails with one error naming both. `@paradoc/react/examples` and `@paradoc/react/examples/pdf` carry a worked sample document as sample material rather than API.
- `@paradoc/react`: tenant branding tokens on `Bundle` and `Document`. `fontFamily`, `accentColor`, `pageSize` (`letter` or `a4`) with `marginPx`, and `logo` (bytes or a source string), declared at the document root and layered over by `renderPdf`'s own `tokens` for a per-render override. The resolved set drives both outputs: the paper the preview's sheet is drawn on and the page the engine writes, the faces the browser loads and the engine embeds, the accent on section headings and the emphasised total, and the mark a composition places through `useDocumentTokens()`. Two families are registered, `Inter Variable` and `Source Serif 4 Variable`; naming any other fails with `UnregisteredFontFamilyError` rather than falling back, because a family the engine cannot embed reaches paper as null glyphs. The furniture and `renderPdf` read the tokens off the element with one pure, synchronous `documentTokensOf`, so a static render and the first browser commit are already on the right paper. Paper and typeface are root-only: a nested `Document` that sets them fails with `NestedPaperTokenError`, and a root that resolves a root-only token differently from whatever is drawing it fails with `RootTokenMismatchError` naming the token, on the PDF path as well as in the preview. Every value is checked before a renderer sees it, with `InvalidDocumentTokenError` naming the token. The default token set renders the reference documents byte for byte as before.
- `@paradoc/serialization` registries gain `date`, `datetime`, `time`, `number`, and `percentage` stringifiers, locale-aware through `Intl` with the same fixed options per registry as the existing composite serializers. `@paradoc/render`'s text, DOCX, and PDF field serializer does not yet dispatch these five types, so a date field still emits raw ISO text in those layers; that follow-up is tracked separately.
- React layers by MIME type. A file layer of MIME type `text/tsx` or `text/jsx` names a composition module; an inline layer of either type is rejected at validation with a message naming the rule. MIME types compare without regard to case, so validation and render dispatch read `TEXT/TSX` the same way. `render({ layer, renderers })` selects a renderer from a MIME-keyed registry — on forms, documents and checklists — so `@paradoc/core` dispatches to a React composition without depending on React: `reactLayerRenderers()` from `@paradoc/react/pdf` builds the registry entries, and binds the layer's module from a `components` map keyed by path or layer key, or by importing the path's default export. Import binding executes the module the artifact names, so the path must be relative and resolve inside `baseDir`. A layer that cannot be bound fails naming the path and both options; a React layer with nothing registered fails naming the layer and the option. `reactLayersOf(artifact)` reports which layers an artifact declares that way. `@paradoc/react/examples` declares its composition layer.
- `para dev`: a live preview of every composition in a project, paginated on screen with its sample data beside the PDF the same tree renders to, with the preview's page breaks passed as hints. A composition whose class the engine cannot express, or whose path the artifact does not declare, shows the finding in place of the PDF; so does one with no artifact, or one whose document throws while it draws. A planned page break the tree no longer carries is named rather than dropped in silence. `--list` prints what the conventions found and exits, `--list --json` reports it as data. The preview uses the project's own toolchain: `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `tailwindcss`, `@paradoc/react`, `react` and `react-dom` are optional peers of `@paradoc/cli`. `@paradoc/react`, `react` and `react-dom` are resolved at the project and nowhere else, because the page loads them; a project missing any of the seven is told which, in the install commands of whichever package manager left a lockfile. Nothing is written to disk.
- `@paradoc/react/discovery`: the conventions that connect a composition to its artifact and its sample, in one place so `para dev` and `para check` cannot disagree. A composition is a `.tsx` or `.jsx` file under a `compositions/` directory; its artifact is the form whose `text/tsx` or `text/jsx` file layer resolves to it, or failing that an artifact file of the same name beside it; its sample data is a sibling `<name>.sample.{ts,tsx,js,mjs,jsx}` before a `sample` export on the composition itself. `para check` now follows the same two fallbacks, which it previously did not.
- The Zod rule and the JSON Schema keyword it emits land now; the dated schema sets under `@paradoc/schemas` are regenerated at release, so `schema.paradoc.dev` carries the rule from the next one.
- Seal markers from the composition itself. `SealOptions` takes the same `renderers` registry `render` takes, and the seal now runs a registered renderer wherever it can: for a React composition it is the renderer the seal uses, producing the PDF itself, so no `SealAdapter` is required and flow placement is no longer refused for it; for every other layer `renderer`, then the registry, then core's own, which is `render`'s own order. The one exception is a flow pass, which only core's marker-injecting text renderer can produce, so an override alongside flow placement is still a `SealConfigError` before anything renders. The flow markers travel to a composition's renderer as `ctx.signing`, typed as `SigningMarkerRequest` in `@paradoc/types`, keyed by slot id and naming the slot's party, index, field type and marker.
- `@paradoc/react`: `Signature` draws one slot. It takes a `type` (`signature` or `initials`, default `signature`) and finds its own marker by party, index and type, so a party signing and initialling is two blocks and two flow slots rather than two slots collapsed into one. A party may carry one flow slot per field type; two of a type on one party fails with `AmbiguousSigningMarkError` naming both. `INITIALS_RULE` joins `SIGNATURE_RULE` and `DATE_RULE`. The composition seals with the slots declared on its own layer and no auxiliary text layer, and a marker the PDF did not receive fails at the render with `MissingSigningMarkerError` naming the slot and glyph coverage.
- Core's own placement failure names the likely cause too: when a marker pass produced a PDF carrying no marker codepoint at all, the `LocateError` gains a sentence about glyph coverage and the codepoints involved, so a third-party renderer that does not check its own output still fails saying what happened.
- A shadcn registry of the document components, served at `https://docs.paradoc.dev/r/{name}.json` under the `@paradoc` namespace. Ten items — `bundle`, `document`, `field`, `keep-together`, `pages`, `paper`, `section`, `signature`, `table`, `totals` — install their source into `components/paradoc/` with the stock CLI (`npx shadcn@latest add @paradoc/field`) or with `para add field`, which registers the namespace in the project's `components.json` first. Generated from the component sources by `pnpm registry:build` in `@paradoc/react`, never hand-written: the generator rewrites every import so the installed file compiles as emitted, and refuses to emit one that reaches for something the package does not export publicly or an npm package the item does not declare. Every `@paradoc/*` dependency is emitted at this package's own version, so an installed component and its substrate stay in lockstep.
- `@paradoc/react` exports the substrate an installed component stands on: `createDocumentContext` and `DocumentContextProvider`; `PageContextProvider`, `usePage`, `useKeepVisible`, `useSectionVisible` and `PageContextValue`; `useSigningMarks`, which `Document` calls on every render and which the browser entry previously did not carry; `markDocumentRoot`, `useDocumentRootTokens`, `useTokenOverride` and `ResolvedRoot`; and `drawnPaper`, `DrawnPaperProvider`, `useDrawnPaper` and `DrawnPaper`. A copied component reads the same contexts the package's own `Pages` provides rather than forking them.
- `para add <name>` installs a document component through `npx shadcn@4`, after registering the `@paradoc` namespace in the project's `components.json`. A name the registry ships is a component; a namespaced reference, a URL, or any other bare name is still an artifact. `--registry` points at a mirror and `--dry-run` prints the install command.
- `@paradoc/react/check`: `checkComposition` resolves a composition against its artifact in a check mode that records every unresolved `Field`/`Table` path and `Signature` party role instead of throwing on the first one, and reports what a render would refuse — those, classes outside the default adapter's verified vocabulary, and image sources with no embedded bytes, all in one pass — without producing PDF bytes. `para check <composition-or-artifact>` runs it from the CLI, installing `@paradoc/react` on first use the way `para render` installs `@paradoc/render`, exits non-zero on any offender, and prints each one with its file and path.

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
