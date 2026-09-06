---
name: compose-documents
description: >
  Compose a Paradoc document as a React component tree with @paradoc/react.
  Activate when writing or editing a .tsx/.jsx composition bound to a Paradoc
  form artifact, when installing document components from the @paradoc
  registry (`para add`, `npx shadcn@4 add @paradoc/<name>`), or when running
  `para check` against a composition. Covers the component vocabulary and
  props, the pagination rule (keep-together units, table header repeat), the
  safe Tailwind class subset the default PDF engine honours, tenant branding
  tokens, the React layer that binds a composition to its artifact, and the
  check command that finds faults without rendering.
metadata:
  author: paradoc
  version: "0.1.0"
  tags: paradoc, react, composition, pagination, registry, pdf
  license: MIT
allowed-tools: "Bash(npx:*) Bash(para:*) Read Write Edit Glob Grep"
---

# Compose a Paradoc document in React

A composition is a React component bound to a Paradoc form artifact through
that artifact's React layer. One tree is the whole document: it is what a
browser paginates on screen and what a PDF engine renders to paper. It never
carries its own copy of a label, a format, or a total — every value comes
from the artifact through the components below.

This skill is for **writing and checking a composition**: which components
exist, how to bind one to its artifact, what CSS the PDF path can render, and
how to verify a composition without rendering it. It does not cover authoring
the artifact itself (fields, parties, defs, logic) — where the `paradoc`
skill is also installed, load its `fields`, `parties`, and `logic` references
for that; otherwise, read the artifact's own schema directly.

## Load a reference

| Reference | Load for |
|---|---|
| [references/components.md](./references/components.md) | The component vocabulary — `Bundle`, `Document`, `Section`, `Field`, `Table`, `Totals`, `Signature`, plus the furniture (`Paper`, `Pages`, `KeepTogether`) — with exact props. |
| [references/pagination.md](./references/pagination.md) | The keep-together rule, how the table header repeats, and the two layout constraints (no `<table>`, one paper declared once). |
| [references/safe-classes.md](./references/safe-classes.md) | Which Tailwind classes the default PDF engine renders, how an unsupported one fails, and branding tokens (font, accent, page size, margin, logo). |
| [references/artifact-binding.md](./references/artifact-binding.md) | Declaring a React layer on a form artifact, binding the module at render time, and the seal (a `Signature` block emits its own marker). |
| [references/cli.md](./references/cli.md) | `para check` (verify a composition without rendering) and `para add` / `npx shadcn@4 add @paradoc/<name>` (install a component). |

## The shape of a composition

```tsx
import { Bundle, Document, Field, Section, Signature, Table, Totals, type DocumentData } from "@paradoc/react";
import type { Form } from "@paradoc/types";

// changeOrderForm is a parsed, validated `Form` (para.form(spec).toJSON() or
// para.load(text).toJSON() from @paradoc/core) — never a raw JSON import.
// See artifact-binding.md#loading-the-artifact.
import { changeOrderForm } from "./change-order";

export interface ChangeOrderProps {
  data: DocumentData;
  /** Defaults to the parsed artifact so the composition also renders standalone. */
  artifact?: Form;
}

export function ChangeOrder({ data, artifact = changeOrderForm }: ChangeOrderProps) {
  return (
    <Bundle id="change-order-bundle">
      <Document artifact={artifact} data={data} id="change-order">
        <Section id="parties" title="Parties">
          <Field path="customer" />
          <Field path="issuedOn" />
        </Section>

        <Section id="lines" title="Revised scope">
          <Table
            path="lineItems"
            id="line-items"
            columns={[
              { field: "description", width: "basis-1/2" },
              { field: "quantity", header: "Qty", width: "basis-1/6", align: "right" },
              { field: "amount", width: "basis-1/6", align: "right" },
            ]}
          />
          <Totals rows={[{ def: "total", emphasis: true }]} />
        </Section>

        <Section id="acceptance" title="Acceptance">
          <Signature party="customer" />
        </Section>
      </Document>
    </Bundle>
  );
}

export default ChangeOrder;
```

Export the composition as the module's **default export** — that is the
convention a React layer's import binding follows (see
[artifact-binding.md](./references/artifact-binding.md)). Accept `data`
(required) and `artifact` (optional, defaulted to the parsed form) as props —
matching `{ artifact, data }`, what core hands the composition at render,
check, and seal time — rather than closing over the artifact as a hardcoded
import with no corresponding prop. `data` is a `DocumentData`:
`{ fields: Record<string, unknown>, parties?: Record<string, unknown> }`.

## Non-negotiable rules

- **Never hand `Document`/`Bundle` a raw JSON import as `artifact`.** It must
  be a parsed, validated `Form` — `para.form(spec).toJSON()` or
  `para.load(text).toJSON()` from `@paradoc/core`. See
  [artifact-binding.md](./references/artifact-binding.md#loading-the-artifact).
- **Never `import "@paradoc/react/styles.css"` inside a composition module.**
  A composition is imported by Node with no CSS loader whenever it is bound
  directly — `para check`, a layer render, a seal — and a stylesheet import
  there fails with "Unknown file extension \".css\"". The stylesheet is an
  app-level concern: import it once where the app's own bundler (Vite,
  Next.js, etc.) already handles CSS, never from inside a `.tsx` a layer or
  `para check` might import through Node.
- **Every value comes from the artifact.** `Field`, `Table`, `Totals`, and
  `Signature` name a path, a def, or a party role — never a literal value or a
  computed string. A path the artifact does not declare is a fault, not a
  blank: `resolveField` throws `UnknownFieldPathError` naming the path.
- **A pagination unit is a `KeepTogether` leaf, never nested inside another
  one.** `Field`, a table row, a table header, a section heading, `Totals`,
  and `Signature` are already keeps. Do not wrap one in another `KeepTogether`
  and do not build a custom keep that contains a `Field` or `Table`. See
  [pagination.md](./references/pagination.md).
- **No `<table>`, `<thead>`, `<tr>`, or `<td>`.** The default PDF engine has no
  table support. `Table` renders flex rows for this reason — compose with it
  or with `div`s, never real table markup.
- **Only the verified Tailwind subset renders to PDF.** A class outside
  [references/safe-classes.md](./references/safe-classes.md) fails the render
  (and `para check`) naming every offender. It is an allow-list, not a
  deny-list: when unsure, check the reference before using a utility class.
  Arbitrary values (`text-[#abc123]`, `p-[3px]`) are never in it.
  `para check --adapter chromium` skips this check because a real browser
  accepts whatever CSS the tree produces — but the default adapter is
  `takumi`, and that is what most renders and most checks use.
  `[data-keep-id]` elements need no page-break class: `KeepTogether` sets that
  itself.
- **Page geometry is declared once, at the document or bundle root, through
  `tokens` — never on `Paper`, `Pages`, or inside a nested composition.** See
  [safe-classes.md](./references/safe-classes.md) for the token set
  (`fontFamily`, `accentColor`, `pageSize`, `marginPx`, `logo`) and its
  failure modes.
- **A `Signature` block needs no extra wiring for the seal.** It draws its own
  marker when the render is a seal pass. Do not add a hidden text layer, a
  separate signature block declaration for the PDF, or manual underscore
  rules — `Signature` already draws the placeholder the seal measures.
- **The composition file is never inline.** An artifact's React layer must be
  a **file layer** with `mimeType: "text/tsx"` or `"text/jsx"` and a `path`
  naming the module, relative to the artifact file. See
  [artifact-binding.md](./references/artifact-binding.md).

## Authoring a new composition

1. Read the artifact (or the form spec) to learn its fields, defs, parties,
   and the React layer's declared path. `reactLayersOf(artifact)` (from
   `@paradoc/core`) lists the layers that need a component bound.
2. Install the components you need: `para add field table signature` (or
   `npx shadcn@4 add @paradoc/<name>`). See
   [cli.md](./references/cli.md#installing-components) — installing `field`
   also brings `keep-together` along, since `field` depends on it. If the
   components already exist in the project (e.g. `@paradoc/react` components
   imported directly rather than installed as source), use those imports
   instead — check for an existing composition to copy from first.
3. Write the `.tsx` file at the path the artifact's layer names, exporting the
   composition as the default export. Compose only from the vocabulary in
   [components.md](./references/components.md).
4. Run `para check <the-composition-or-artifact>`. Fix every unresolved path
   and unsupported class it names. See
   [cli.md](./references/cli.md#checking-a-composition).
5. If `@paradoc/react/pdf` is available, render it and inspect the PDF — this
   is the file that will be sealed, byte for byte.

## Common mistakes

| Symptom | Cause | Fix |
|---|---|---|
| `UnknownFieldPathError` | `Field`/`Table`/`Totals` names a path or def the artifact does not declare. | Check the artifact's `fields`/`defs` keys; fix the typo rather than hardcoding a value. |
| `para check` reports an unsupported class | A Tailwind class outside the verified subset, or an arbitrary value like `text-[13px]`. | Replace with the nearest class in [safe-classes.md](./references/safe-classes.md), or restructure with spacing/sizing utilities that are on the list. |
| `RootTokenMismatchError` / `NestedPaperTokenError` | `pageSize`, `marginPx`, or `fontFamily` set on a `Document` nested inside a `Bundle`, or a composition setting tokens on itself instead of forwarding a `tokens` prop. | Set paper tokens once, on the outermost `Bundle` or `Document`; a nested document may still set `accentColor` and `logo`. |
| A page silently loses the organization mark or a branded font | Font family or logo not registered, or the composition rendered without the `tokens` the caller resolved. | Only use a font family listed in [safe-classes.md](./references/safe-classes.md#branding-tokens); pass `tokens` through rather than hiding them inside the composition. |
| `AmbiguousSigningMarkError` | Two `Signature` blocks for the same party and the same `type` (both `signature`, say). | One block per party per field type; a party that signs and initials is two blocks with different `type`. |
| Composition compiles but `para check` can't find its artifact | The artifact does not declare a React layer whose `path` resolves to this file. | Add or fix the `layers.<key>` entry: `kind: "file"`, `mimeType: "text/tsx"`, `path` relative to the artifact file. |
