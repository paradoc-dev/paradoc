---
name: paradoc
description: >
  Paradoc — documents-as-code framework for type-safe artifacts (forms, documents,
  bundles, checklists). Activate for work with the TypeScript SDK (@paradoc/*),
  para CLI, JSON/YAML artifacts, schema validation, or the remote MCP service.
  Covers filling, validation, rendering, layers, fields, parties, signatures,
  annexes, logic, bundles, form creation, and conversion of PDF forms into
  Paradoc artifacts, including AcroForm bindings and signature blocks.
metadata:
  author: paradoc
  version: "0.1.0"
  tags: paradoc, sdk, cli, schemas, mcp, forms, documents, bundles, checklists, rendering
  license: MIT
allowed-tools: "Bash(npx:*) Read Write Edit Glob Grep WebSearch"
---

# Paradoc

Paradoc is a documents-as-code framework. You define structured **artifacts** (forms, documents, bundles, checklists), fill them with data, validate, and render them to PDF, DOCX, or text.

This skill covers every Paradoc surface and workflow. Use the dispatch tables below to load the right reference for the current task.

## Global Rules

These apply across every surface and workflow:

- **Schema version:** `2026-08-06`. `$schema` URIs follow the form `https://schema.paradoc.dev/2026-08-06/<form|document|bundle|checklist>.json`.
- **Validation:** ALWAYS run `npx paradoc validate <file>` (NOT `para validate`) when working with files directly. The `npx` form ensures availability without requiring a global install. Validate after every change. NEVER skip.
- **Artifact name pattern:** `^[A-Za-z0-9]([A-Za-z0-9]|-[A-Za-z0-9])*$` — kebab-case preferred, no leading/trailing/consecutive hyphens.
- **Field/party/def/rule identifier pattern:** `^[a-z][a-zA-Z0-9_]*$` — camelCase, max 100 chars (50 for party roles).
- **Versioning:** semver `MAJOR.MINOR.PATCH`. Major for breaking changes, minor for new optional, patch for cosmetic.
- **Field types:** ALWAYS use the most specific type — NEVER `text` when a structured type fits (`money`, `date`, `email`, `phone`, `address`, etc.).
- **Paradoc templates:** field values are spread at top level — use `{{fieldName}}`, NOT `{{fields.fieldName}}`. Parties and annexes remain namespaced (`{{parties.tenant}}`, `{{annexes.photoId}}`).
- **Signatures in templates:** use `{{signature "loc"}}`, `{{initials "loc"}}`, `{{signatureDate "loc"}}` helpers inside party blocks (`{{#with}}` or `{{#each}}`). NEVER manual underscore lines.

## Pick a Surface

Load ONE surface ref based on how the user is working:

- Writing or modifying TypeScript that imports from `@paradoc/*` → load [references/sdk.md](./references/sdk.md)
- Using the `para` / `npx paradoc` CLI → load [references/cli.md](./references/cli.md)
- Editing artifact JSON or YAML directly → load [references/schemas.md](./references/schemas.md)
- Working through the remote MCP service at `mcp.paradoc.dev` → load [references/mcp.md](./references/mcp.md)

If multiple surfaces apply (e.g., SDK code that calls the CLI), load each as needed.

## Working on a Topic

Topic refs are surface-agnostic — they describe the underlying concept and contain both JSON and SDK examples where appropriate. Load when working on that aspect:

| Topic | Load |
|-------|------|
| Top-level artifact shapes (form / document / bundle / checklist) | [references/artifacts.md](./references/artifacts.md) |
| Fields — types, identifiers, constraints, fieldsets | [references/fields.md](./references/fields.md) |
| Parties — roles, signatures, witnesses, notary | [references/parties.md](./references/parties.md) |
| Annexes — file attachments | [references/annexes.md](./references/annexes.md) |
| Logic — CondExpr, defs, rules | [references/logic.md](./references/logic.md) |
| Layers — templates, MIME types, signature blocks, template syntax | [references/layers.md](./references/layers.md) |
| PDF AcroForm bindings, signature block coordinates | [references/pdf-bindings.md](./references/pdf-bindings.md) |
| Rendering — text, PDF, DOCX, resolvers | [references/rendering.md](./references/rendering.md) |
| Serialization — locale-aware Money / Address / Phone / Person formatting | [references/serialization.md](./references/serialization.md) |
| Instructions / agentInstructions — ContentRef | [references/instructions.md](./references/instructions.md) |

## Workflows

End-to-end pipelines that orchestrate multiple topics. Load when the user requests one of these tasks:

- Create a new form from requirements ("create a form for X", "build a form", "design a form") → follow [references/workflow-create-form.md](./references/workflow-create-form.md)
- Convert a PDF form into a Paradoc artifact ("convert this PDF", "extract PDF fields", "PDF to form") → follow [references/workflow-convert-pdf.md](./references/workflow-convert-pdf.md)

Workflows link to topic refs at each stage. Load topic refs as the workflow directs.

## Common Issues (Cross-Surface)

**Validation: "unknown field type"**
Common mismatches: `string` → `text`, `number` (when money) → `money`, `currency` → `money`, `datetime` (when date-only) → `date`. See [fields.md](./references/fields.md).

**Render produces blank or empty output**
Forms rendered without data produce empty output. ALWAYS pass data (CLI: `--data`, SDK: `form.fill(data).render(...)`). Validate the artifact first. Ensure layer MIME type matches the renderer.

**Wrong import paths (SDK)**
NEVER import from `@paradoc/core/dist/...` — only from package root. See [sdk.md](./references/sdk.md).

**Mixing builder and object pattern (SDK)**
Pick one per artifact. Object pattern uses plain objects for fields; builder uses `para.field.*()` chains. NEVER mix.

**Missing layer / no rendering output**
Renderer requires at least one layer. Set `defaultLayer` when multiple layers exist. See [layers.md](./references/layers.md).

**Schema duplication when bundling (SDK)**
ALWAYS pass `{ includeSchema: false }` to `toJSON()` when inlining artifacts in a bundle.

**Expression context confusion**
Field-level (`required`, `visible`) uses `fields.<id>`. Rules section uses bare field names. Defs in field-level expressions use direct def key names (NOT `fields.<defKey>`). See [logic.md](./references/logic.md).
