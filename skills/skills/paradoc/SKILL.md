---
name: paradoc
description: >
  Paradoc artifacts (forms, documents, checklists, bundles): author, fill,
  validate, render, and seal them with @paradoc/sdk, the paradoc CLI, JSON/YAML
  files, @paradoc/ai-tools, or the mcp.paradoc.dev server. Use when creating a
  form or converting a PDF form, binding PDF fields or reading a filled PDF,
  writing defs, rules, conditions, or templates, filling a form step by step,
  signing or sealing, giving an agent Paradoc tools, using a ready-made W-9,
  1099, I-9, or ACH form, or migrating an artifact. For documents written in
  React, use paradoc-react.
metadata:
  author: paradoc
  version: "0.6.0"
  tags: paradoc, sdk, cli, schemas, ai-tools, mcp, forms, pdf, signing, rendering
  license: MIT
allowed-tools: "Bash(npx:*) Bash(node:*) Read Write Edit Glob Grep"
---

# Paradoc

Paradoc is a documents-as-code framework. An **artifact** (form, document, checklist or bundle) is a typed JSON/YAML definition. You fill a form to get a **draft**, validate it, render it to text, Markdown, HTML, DOCX or PDF, and seal it for signing.

## Global rules

- **Schema version.** Every artifact sets `$schema` to `https://schema.paradoc.dev/2026-09-22.json`. Migrate an older file with `npx paradoc-cli migrate <file>`.
- **Validate** each file after every change with `npx paradoc-cli validate <file>` (one file per call). Run the CLI as `npx paradoc-cli`; the npm package `paradoc` is unrelated.
- **Identifiers.** Artifact names match `^[A-Za-z0-9]([A-Za-z0-9]|-[A-Za-z0-9])*$`. Field, party, def and rule ids match `^[a-z][a-zA-Z0-9_]*$`. Details per key: [schemas.md § Identifier patterns](./references/schemas.md#identifier-patterns).
- **Field types.** Use the most specific type: `money`, `date`, `email`, `phone`, `address` and so on, not `text`. See [fields.md § Type selection table](./references/fields.md#type-selection-table).
- **Expressions.** Use `and`, `or`, `not`. Read fields as `fields.<id>` and defs by bare name. A condition must be boolean (`isNotEmpty(fields.x)`, not `fields.x`). Read money as `fields.price.amount` for arithmetic and comparison. See [logic.md](./references/logic.md).
- **Templates** name values as `{{fields.x}}`. Place every signing mark with a directive such as `{{signature(parties.tenant, "tenant-sig")}}`. The location string is a slot id in the layer's `signatures`, one slot per party and type.
<!-- dep:C8 -->
- **PDF bindings** exist only on PDF layers. Keys are the PDF's field names (from `paradoc inspect`); values are bare Paradoc paths such as `petName` or `parties.tenant.name`.
- **Drafts are immutable.** Every draft and signable method returns a new form; reassign it. <!-- dep:C1 --> `update()` is the one way to change a draft's field values.
- **Finish line.** Authoring is done when the round trip passes: `data template` → `render --data` → `data extract` (see [cli.md § Round trip](./references/cli.md#round-trip)).

## Packages

Install `@paradoc/sdk`: it re-exports `core`, `render`, `format` and `sessions`, and `expr` as a namespace. Add others only for their job.

| Package | Use it for |
|---------|-----------|
| `@paradoc/sdk` | Define, load, fill, validate, render and seal artifacts; `hostedSealAdapter` |
| `@paradoc/resolvers` | Load layer files: `@paradoc/resolvers/fs`, `@paradoc/resolvers/memory` (no root export) |
| `@paradoc/essentials` | Finished forms: W-9, 1099, 4506-T, I-9, ACH ([essentials.md](./references/essentials.md)) |
| `@paradoc/ai-tools` + `@paradoc/ai-sdk` / `mastra` / `tanstack-ai` | Paradoc tools for your own agent |
| `paradoc-cli` | The `paradoc` command |
| `@paradoc/react`, `@paradoc/react-pdf` | Documents written in React: use the `paradoc-react` skill |

More: [sdk.md § Packages](./references/sdk.md).

## Pick a surface

Load the ref for how the user works. Load more than one when surfaces mix.

| The user is... | Load |
|----------------|------|
| Writing TypeScript that imports `@paradoc/*` | [references/sdk.md](./references/sdk.md) |
| Running `paradoc` commands | [references/cli.md](./references/cli.md) |
| Editing artifact JSON or YAML by hand | [references/schemas.md](./references/schemas.md) |
| Giving their own agent Paradoc tools (AI SDK, Mastra, TanStack AI) | [references/ai-tools.md](./references/ai-tools.md) |
| Using the hosted MCP server at `mcp.paradoc.dev` | [references/mcp.md](./references/mcp.md) |
| Writing a `.tsx`/`.jsx` document or a `text/tsx` layer | the `paradoc-react` skill |

The AI tool packages and the MCP server are different tool sets with different names.

## Topics

Topic refs are the one source for each concept. Load the one the task touches.

| Task | Load |
|------|------|
| The four artifact kinds, base keys, bundle `include` | [references/artifacts.md](./references/artifacts.md) |
| Field types, properties, the fill value for each type, field builders | [references/fields.md](./references/fields.md) |
| Party roles, required roles, `payment`, party fill data | [references/parties.md](./references/parties.md) |
| File attachments | [references/annexes.md](./references/annexes.md) |
| Conditions, defs, rules, functions, dates, totals over rows | [references/logic.md](./references/logic.md) |
| Declaring layers, MIME types, `signatures` slots, `defaultLayer` | [references/layers.md](./references/layers.md) |
| Text, Markdown, HTML and DOCX templates, loops, signing directives | [references/templates.md](./references/templates.md) |
| PDF field names and coordinates, bindings, fit, fonts, reading a filled PDF | [references/pdf.md](./references/pdf.md) |
| Rendering in code or CLI, resolvers, PDF utilities | [references/rendering.md](./references/rendering.md) |
| Locale-aware display of values | [references/formatting.md](./references/formatting.md) |
| `instructions` and `agentInstructions` | [references/instructions.md](./references/instructions.md) |
| Filling step by step, fill state, checking one answer, saving and resuming a draft, sessions | [references/filling.md](./references/filling.md) |
| Signers, sealing, capture, signature map, witnesses, packets | [references/sealing.md](./references/sealing.md) |

## Workflow

To create a form from requirements or convert a PDF form ("create a form for X", "convert this PDF", "PDF to form"), follow [references/workflow-author-form.md](./references/workflow-author-form.md). Pass each stage's check before starting the next.

When the user needs a W-9, 1099, 4506-T, I-9 or ACH form, use its `@paradoc/essentials` export instead of authoring one: load [references/essentials.md](./references/essentials.md).

## Errors

Look up an error message in the ref for the surface that raised it: [sdk.md § Errors](./references/sdk.md#errors) (SDK), [cli.md § Errors and fixes](./references/cli.md#errors-and-fixes) (CLI), [schemas.md § Error messages](./references/schemas.md#error-messages) (validator), [rendering.md § Errors](./references/rendering.md#errors) (render) and [sealing.md § Seal errors](./references/sealing.md#seal-errors) (seal). Expression errors are explained in [logic.md](./references/logic.md).
