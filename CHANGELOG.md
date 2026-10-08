# Changelog

All notable changes to Paradoc. Packages are versioned in lockstep.

## [Unreleased]

## [0.7.0] - 2026-10-08

Paradoc 0.7 records who issued a form and which edition an artifact encodes, and lets bundles address registry artifacts by edition and version. It also adds PDF digital-signature helpers and per-overlay fonts to the renderer.

### Highlights

- Artifacts carry an optional `issuer` and `edition` (`key`, `label`, `date`, `effectiveFrom`), and `code` is the form number as the issuer prints it.
- Registry coordinates take the form `@org/repo/name[/edition][@version]`, with helpers to parse and format them.
- `@paradoc/render/pdf` can prepare, embed and read a PDF digital signature.
- PDF text overlays can each use their own font, and `pdfFontMetrics()` reports whether a font can draw a string and how wide it is.
- `paradoc migrate` moves artifacts to schema `2026-10-02`.

### Breaking changes

#### Schemas and artifacts

- Schema `2026-10-02` removes `releaseDate`. Record the issuer and edition with `issuer` and `edition` instead.
- A registry bundle item's `slug` is only the address `@org/repo/name`. Edition and version move to the new `edition` and `version` fields. Edition keys cannot be `current`, `latest`, `editions`, `tags` or `diff`.
- The hosted `2026-09-24` schemas are removed from `schema.paradoc.dev`. Run `paradoc migrate` to move files to `2026-10-02`.

#### Core and SDK

- The builders drop `.releaseDate()` for `.issuer()` and `.edition()`. `.registry(key, coordinate, include?)` takes a full three-segment coordinate and throws a `TypeError` on any other value.

#### Essentials

- Each form's `spec` has a top-level `issuer` instead of `metadata.issuer`, and `metadata.sourceUrl` is removed.

### Upgrading from 0.6

1. Run `paradoc migrate <file-or-directory> --dry-run`, review the changes, then rerun without `--dry-run`. The step removes `releaseDate` and moves a slug's `@version` into `version`.
2. Correct by hand any registry slug that is not `@org/repo/name[@version]`, such as `@paradoc/essentials/tax/w-9@1.0.0`. The migration stops on it.
3. Replace `.releaseDate()` with `.issuer()` and `.edition()`, and pass full `@org/repo/name` coordinates to `.registry()`.
4. Read `issuer` from an essentials form's `spec` instead of `spec.metadata.issuer`.

### Other changes

#### Schemas and types

- `@paradoc/schemas` exports `parseArtifactCoordinate`, `formatArtifactCoordinate`, `ArtifactCoordinateSchema`, the edition and version selector schemas, and the reserved edition keys. `@paradoc/types` exports `ArtifactEdition`.

#### Core

- `sealBundle` refuses a part whose edition differs from the edition its bundle item declares.

#### Render

- `preparePdfSignature`, `signedBytes`, `embedPdfSignature` and `readPdfSignature` sign a PDF with a container from any signing service.
- A text overlay takes its own `font`, and `pdfFontMetrics(font)` returns `canDraw` and `width`.
- Rendering on a page that an earlier render drew on keeps the earlier fonts and images.

#### CLI

- `paradoc show` prints the issuer and edition, and shows registry bundle items as full coordinates. `paradoc new --code` sets the issuer's form number.
- The CLI sends all telemetry to `telemetry.paradoc.dev`. Public-registry installs send a `directory.installed` event in the same batch, and nothing goes to `tasks.paradoc.dev`. `PARADOC_TELEMETRY_URL` points the CLI at another telemetry origin, such as `https://telemetry-dev.paradoc.dev`.

#### AI tools

- `inspect_artifact` returns the artifact's issuer and edition.

## [0.6.1] - 2026-09-28

Paradoc 0.6.1 tightens prerelease schema distribution and makes the documentation easier for people and agents to discover. It also publishes a reusable service-layer boundary for projects using the Paradoc ESLint configuration.

### Highlights

- `@paradoc/schemas` now packages only the current dated schema set and live-root schemas, while older prerelease schemas remain available through Git history.
- The documentation publishes a permanent page for each release alongside the latest changelog index.
- Canonical URLs, a generated sitemap, and improved Markdown responses make documentation routes easier for search engines and agents to discover.
- `@paradoc/eslint-config/service-boundary` enforces API-free service modules by preventing imports from co-located contracts and `@paradoc/api-kernel`.

### Other changes

#### Documentation

- Public navigation no longer advertises the hosted MCP reference; AI guidance directs developers to the published adapter packages for in-process tools.
- Sidebar and content-grid behavior is more consistent across documentation pages.

## [0.6.0] - 2026-09-25

Paradoc 0.6 turns documents into a complete application surface: compose them in React, migrate versioned artifacts, extract filled PDFs, and seal multi-document packets. It also tightens public contracts across the SDK, CLI, rendering, sessions, and AI adapters.

### Highlights

- Dated schemas and `paradoc migrate` make artifact upgrades explicit, reviewable, and reversible with `--dry-run`.
- React layers, live `paradoc dev` previews, `paradoc check`, and the copyable component registry provide an end-to-end document composition workflow.
- `sealBundle` prepares and seals multi-part packets with one canonical PDF, packet-wide signer mapping, and part-level provenance.
- PDF rendering now embeds fonts, follows AcroForm appearance settings, rejects encrypted inputs, and can extract filled values back into artifact data.
- Templates and artifact logic share `@paradoc/expr`, including typed conditions, list aggregates, party data, and row-aware expressions.
- `@paradoc/format` replaces serialization with locale-aware formatting shared by text, DOCX, PDF, and React output.
- AI SDK, TanStack AI, and Mastra adapters expose the same validated document operations, including extraction and progressive filling.

### Breaking changes

#### Schemas and artifacts

- Artifact files must use the current dated `$schema`; run `paradoc migrate` before loading older, undated, or unversioned files.
- Signing fields now live only in `signatures`; migrate legacy `signatureBlocks` and `anchorBlocks` to signature slots.
- Field, party, option, and config schemas reject unknown keys; correct misspellings instead of relying on dropped properties.
- The marker placement literal is `flow`, not `auto`; the migration rewrites existing slots.

#### Core and SDK

- Import the builder namespace as `p` instead of `para`.
- `fill()` and `safeFill()` are progressive; replace partial-fill APIs with `fill()` followed by `update()`.
- Bind file resolvers when constructing or loading an artifact, not in `render()`, `seal()`, or bundle operations.
- Pass a `SealAdapter` through `seal({ adapter })`; the legacy `Sealer` overload and formal-signing aliases are removed.
- Replace `DraftForm.setField()` and `updateFields()` with `draft.update({ fields: ... })`.
- Custom renderers must read `parties`, `annexes`, `signers`, `captures`, and `defs` beside `data.fields`.

#### Rendering and React

- Import PDF runtime APIs from `@paradoc/react-pdf`; `@paradoc/react` now contains the headless React runtime and discovery APIs.
- Text and DOCX templates must use full paths such as `{{fields.name}}`; binding aliases are supported only on PDF file layers.
- PDF bindings now fail on missing fields, invalid roots, and malformed qualifiers; use AcroForm field names as keys and Paradoc paths as values.
- Replace legacy template helpers and Handlebars context paths with artifact expressions, `item`, `parent`, and `index(item)`.
- Application styles own typography; remove `fontFamily` tokens and registered package font families.
- Remove PDF signature rendering options and deprecated SDK renderer wrappers; use built-in rendering or `@paradoc/render` subpaths.

#### CLI, sessions, AI, and resolvers

- The CLI, `@paradoc/ai-tools`, `@paradoc/ai-sdk`, and `@paradoc/tanstack-ai` require Node.js 22 or newer.
- Invoke the CLI as `paradoc`; the `para` binary is removed.
- Configure every registry explicitly; the CLI no longer falls back to a default registry.
- Session projections now include annexes and richer party state; persist events directly instead of using the removed spine adapter.
- Use the unified `@paradoc/ai-tools` operation contracts and renamed validation outputs.
- Import resolvers from `@paradoc/resolvers/fs`, `/http`, or `/memory`; the package root exports nothing.
- Replace `@paradoc/serialization` with `@paradoc/format` and pass a formatter through render context.

### Upgrading from 0.5

1. Upgrade CLI and AI runtimes to Node.js 22 or newer.
2. Run `paradoc migrate <file-or-directory> --dry-run`, review the schema and signature-slot changes, then rerun without `--dry-run`.
3. Rename `para` imports to `p`, bind resolvers when artifacts are constructed, and replace removed draft and fill helpers.
4. Install `@paradoc/react-pdf` for React PDF rendering, checking, or Chromium output and update imports from `@paradoc/react`.
5. Replace template binding aliases and helpers, then run `paradoc validate` and `paradoc check` across the migrated project.

### Other changes

#### Core, schemas, and sessions

- Builders cover every schema key, and validation reports schema versions, file references, template expressions, signing slots, and PDF bindings earlier.
- List aggregates, typed party expressions, row references, progressive checklists, annex commands, and rule IDs improve guided form completion.
- Bundle rendering preserves nested parts, while sealing and finalization enforce signer, capture, and required-slot integrity.

#### Render, React, and components

- PDF fill and extraction support embedded fonts, Unicode strings, comb fields, multiline values, overlays, page selection, flattening, and merging.
- React documents add pagination, page furniture, explicit breaks, application fonts, right-to-left output, annex images, and packet previews.
- The `@paradoc` component registry ships document components and complete blocks for invoices, engagement letters, purchase orders, and vendor packets.
- Formatters add selection, rating, contact, temporal, money, party, attachment, and signature output with locale fallbacks and structured issues.

#### CLI, SDK, and AI

- `paradoc migrate`, `data extract`, `dev`, and `check` cover schema upgrades, PDF recovery, live composition previews, and static composition checks.
- CLI validation accepts multiple artifacts, validates project files and data through core, and preserves installed layer dependencies and checksums.
- AI adapters share bounded model output, validated inputs and outputs, fill-state inspection, updates, rendering, and extraction.
- `hostedSealAdapter` uses the served conversion route, supports cancellation, and reports structured conversion and response errors.

#### Packages

- `@paradoc/react`, `@paradoc/react-pdf`, `@paradoc/format`, and `@paradoc/mastra` join the public framework.
- `@paradoc/resolvers/http` safely resolves file-backed layers beneath a base URL in any runtime with `fetch`.
- Essentials artifacts and examples use current schemas, signature slots, formatter behavior, and rendering limits.

## [0.5.0] - 2026-08-10

Paradoc 0.5 introduces a single signature-slot model and a dependency-light placement engine for preparing documents before signing.

### Highlights

- Layers declare a unified `signatures` map for marker, anchor, or absolute signature placement.
- `prepareSeal()` returns the exact pre-flatten PDF, resolved fields, provenance, and warnings without changing form state.
- The built-in PDF locator resolves signature markers and anchor text without a PDF rendering engine.
- Pure byte converters such as `hostedSealAdapter` work with anchor-based sealing without extra placement configuration.

### Breaking changes

#### Core and types

- `SealingRequest.options` is removed; stop passing its unused `renderer` or `format` keys.

### Other changes

#### Schemas and render

- Schema version `2026-08-10` adds signature slots while keeping the published `2026-08-06` schemas available.
- `SealOptions.locate` allows a custom placement locator when the built-in PDF locator is not suitable.
- PDF parsing resolves indirect stream lengths, preserving content from PDFs written by LibreOffice.

## [0.4.0] - 2026-08-06

Paradoc 0.4 consolidates rendering into one dependency-light package and makes MIME-selected rendering the default across the framework.

### Highlights

- `@paradoc/render` renders text, Markdown, HTML, PDF, and DOCX layers through one public package.
- Form rendering and sealing select built-in renderers by MIME type while preserving custom renderer overrides.
- Recursive list fields work across builders, schemas, validation, serialization, and rendering.
- Sealing can flatten PDFs locally and delegate non-PDF conversion through an adapter.

### Breaking changes

#### Render

- Replace `@paradoc/renderers` and the format-specific renderer packages with `@paradoc/render` and its `/text`, `/pdf`, and `/docx` subpaths.

### Upgrading from 0.3

1. Update renderer imports and remove dependencies on `@paradoc/renderer-text`, `@paradoc/renderer-pdf`, and `@paradoc/renderer-docx`.

### Other changes

#### Schemas

- Schema version `2026-08-06` becomes current while the published `2026-01-01` schemas remain available.
- Rendering and e-signing paths no longer require the previous heavy PDF, DOCX templating, and Handlebars dependency stack.

## [0.3.0] - 2026-06-19

Paradoc 0.3 adds a purpose-built expression language and publishes the deterministic session engine for guided form completion.

### Highlights

- `@paradoc/expr` provides a typed parser, evaluator, and artifact-aware checker with exact decimal and temporal values.
- `@paradoc/sessions` provides an event-sourced, storage-agnostic form-completion engine.
- Fill state reports one visibility and requirement status, transitive blockers, and the next field in dependency order.
- The SDK exposes expression APIs through `expr`, including parsing, checking, and `Decimal`.

### Other changes

#### Core

- Artifact logic runs on `@paradoc/expr`, and hidden fieldsets now hide their full subtree.
- The `expr-eval-fork` dependency is removed.

## [0.2.0] - 2026-05-19

Paradoc 0.2 adds labeled enum choices and source-language metadata across artifacts, schemas, builders, and CLI workflows.

### Highlights

- Enum and multiselect options use `{ value, label? }`, allowing display labels without changing stored values.
- Artifacts can declare a BCP 47 source language through `language`.
- Shared artifact methods expose the artifact `code`.

### Breaking changes

#### Types and schemas

- Replace primitive enum arrays with `EnumOption[]`; multiselect defaults now contain option values rather than option objects.

### Upgrading from 0.1

1. Rewrite enum options as `{ value, label? }` and keep multiselect defaults as the selected primitive values.

### Other changes

#### CLI and schemas

- CLI fill, validation, and template commands understand labeled options.
- Published per-form JSON schemas are regenerated without the stale non-standard `id` property.

## [0.1.1] - 2026-05-08

This patch expands signature blocks and corrects rendering and schema behavior for common field values.

### Highlights

- Signature blocks support `capacity` and `printed_name`, with matching text and PDF helpers.
- PDF rendering handles multiselect arrays in qualified checkbox bindings.
- Address-region schema and rendering behavior are corrected.

### Other changes

#### Packages

- All public packages remain on the same 0.1.1 lockstep version.

## [0.1.0] - 2026-04-28

The first public Paradoc release establishes documents as typed, machine-readable artifacts for applications and AI agents.

### Highlights

- Typed builders define forms, documents, checklists, bundles, parties, fields, annexes, and output layers.
- Core validation checks artifact definitions and filled data against shared Zod and JSON Schema contracts.
- Text, PDF, and DOCX renderers produce multiple outputs from the same artifact definition.
- `@paradoc/sdk` provides the all-in-one framework entry point, with CLI and AI adapter packages alongside it.
- The published packages support Node.js 18 and are released in lockstep under the MIT license.
