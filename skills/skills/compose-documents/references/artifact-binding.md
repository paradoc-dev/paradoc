---
name: artifact-binding
description: Declaring a React layer on a form artifact, binding the composition module at render time, and how the seal locates a Signature block's marker.
metadata:
  tags: artifact, layer, binding, render, seal
---

# The React layer

**Contents:** [Loading the artifact](#loading-the-artifact) ·
[Declaring the layer](#declaring-the-layer) ·
[Finding the layer from a composition](#finding-the-layer-from-a-composition) ·
[Binding the module at render time](#binding-the-module-at-render-time) ·
[Rendering](#rendering) · [The seal](#the-seal) ·
[Failure modes](#failure-modes)

## Loading the artifact

`Document`'s `artifact` prop, and a composition's own `artifact` prop when it
takes one, both want a **parsed, validated `Form` value** — plain data
(fields, defs, parties, layers), not a class instance and never a raw
`JSON.parse`/`import … from "./x.json"` of the artifact file. (`Bundle` has
no `artifact` prop — it groups `Document`s, each of which binds its own.)
Untyped JSON has not been schema-validated, so a typo the schema would catch
(a field type that does not exist, a malformed def expression) reaches
`Document` instead of failing at load time.

Get a `Form` value one of two ways, both from `@paradoc/core`:

- **The artifact is authored as a spec object or with the builder** (as the
  package's own sample artifact is): `para.form(spec).toJSON()` parses and
  validates it, and `.toJSON()` is what turns the builder's result into the
  plain `Form` value every component expects.
- **The artifact is stored as a JSON/YAML file**: read its text and pass it
  to `para.load(text).toJSON()` (or `para.safeLoad`, which returns a result
  object instead of throwing).

```ts
// change-order.ts — a sibling module the composition imports the parsed form from
import { readFileSync } from "node:fs";
import { para } from "@paradoc/core";
import type { Form } from "@paradoc/types";

export const changeOrderForm: Form = para
  .load(readFileSync(new URL("./change-order.json", import.meta.url), "utf8"))
  .toJSON() as Form;
```

**A composition itself usually does not load the artifact at all.** At
render, check, or seal time, core (or `checkComposition`/`checkElement`)
already calls the composition with `{ artifact, data }` fully resolved — see
[Binding the module at render time](#binding-the-module-at-render-time). The
loading step above matters when a composition also takes `artifact` as an
**optional** prop, defaulted to the parsed form, so it can be rendered
directly for a preview or a test without going through a layer at all:

```tsx
export function ChangeOrder({ data, artifact = changeOrderForm }: { data: DocumentData; artifact?: Form }) {
  return (
    <Document artifact={artifact} data={data}>…</Document>
  );
}
```

A composition is bound to its form artifact through a **file layer** whose
`mimeType` is `text/tsx` or `text/jsx`. The layer's `path` is a pointer to
the module, relative to the artifact file that declares it — nothing reads
that file as content, and nothing executes it until render time.

## Declaring the layer

```ts
layers: {
  composition: {
    kind: "file",
    mimeType: "text/tsx",
    path: "change-order.tsx",
    title: "Composition",
    signatures: {
      "customer-signature": { party: { role: "customer" }, type: "signature", placement: "flow" },
    },
  },
},
defaultLayer: "composition",
```

Rules the artifact's own schema enforces, at validation time:

- **Only a file layer may declare `text/tsx`/`text/jsx`.** An **inline**
  layer of either MIME type is rejected — a composition is a module, not
  embedded source.
- Signature slots on a React layer work exactly like on any other layer —
  `placement: "flow"` — but the marker is drawn by the `Signature` component
  itself (see [The seal](#the-seal)), not by a converter.

A further rule is enforced later, only on the import-binding route, not by
the schema: **the `path` is confined to the layer's own module.** When a
renderer binds the layer by importing it (see
[Binding the module at render time](#binding-the-module-at-render-time)), the
path must be relative and must resolve inside the artifact's directory (or
whatever `baseDir` the renderer is given); an absolute path, or one that
climbs out, is refused at bind time rather than loaded. A layer bound through
a `components` map instead is never checked this way — the map already names
the exact component, so there is no path to confine.

## Finding the layer from a composition

`reactLayersOf(artifact)` (from `@paradoc/core`) lists every layer on a form
that needs a React component bound, each as `{ key, path, mimeType }`. Use it
to discover which layer(s) a given artifact expects a composition for, and
to confirm a newly-authored composition's file matches the `path` a layer
already declares — `para check <composition-file>` does this search
automatically (see [cli.md](./cli.md#checking-a-composition)).

## Binding the module at render time

Core selects a renderer by the layer's MIME type from the render call's
`renderers` registry; it never depends on React itself. Register the React
renderer at the render call:

```ts
import { reactLayerRenderers } from "@paradoc/react/pdf";
import { ChangeOrder } from "./orders/change-order";

const pdf = await changeOrderArtifact.render<Uint8Array>({
  layer: "composition",
  renderers: reactLayerRenderers({
    components: { "change-order.tsx": ChangeOrder },
    pdf: { images: [{ src: "change-order:logo.png", data: logoBytes }] },
  }),
});
```

The renderer binds the layer's `path` (or its key) to a component two ways,
tried in this order:

1. **`components` map** — keyed by the layer's `path` or by its key in the
   artifact. What a bundled application uses; no filesystem access needed.
2. **Import binding** — resolves the `path` against `baseDir` (the artifact
   file's own directory) and takes the module's `default` export. This is
   what makes exporting the composition as a **default export** load-bearing:
   an import-bound layer with no default export fails.

A path neither option covers fails with `UnboundReactLayerError`, naming the
path and both binding options. A React layer with no renderer registered at
all fails from core with `UnregisteredLayerRendererError`.

**Import binding executes the module the artifact names.** This is the one
place an artifact — data — becomes code, so the path is confined as
described above. If the artifact is not fully trusted, bind through
`components` and leave `baseDir` unset, which turns the import route off.

## Rendering

The engine fetches no images: everything the tree names as an `src` must
arrive as bytes keyed by that same string, via `pdf: { images: [...] }`.
Anything the engine cannot express — a class outside
[safe-classes.md](./safe-classes.md), an undecodable image — fails the
render naming every offender, the same information `para check` reports
ahead of time.

## The seal

A composition needs **no auxiliary layer, no hidden text, and no manual
marker wiring** to be a seal target. On a seal's marker pass, core hands the
layer's renderer one marker per signature slot, keyed by slot id; the
`Signature` component for that slot's party and field type writes its own
marker immediately before its rule, in the same text run the seal's locator
measures. Every other render (not a seal pass) carries no markers, and
`Signature` draws its rule alone — the sealed document and a plain render of
the same tree are byte-identical apart from the marker itself.

What this means for authoring:

- Never draw a signature rule as a border or a styled `div` — `Signature`'s
  own placeholder (sixteen underscores) is what the seal measures a field
  from; a border gives it nothing to measure.
- Never add a second, hidden layer or a manual `signatureBlocks`/
  `anchorBlocks` declaration alongside a React layer's `signatures` — the
  slot on the layer itself, plus the matching `Signature` component in the
  tree, is the whole mechanism.
- One `Signature` block per party per field type. `AmbiguousSigningMarkError`
  names both blocks when two collide.

## Failure modes

| Error | Cause |
|---|---|
| `UnknownFieldPathError` | `Field`/`Table`/`Totals` names a path or def the artifact schema does not declare. |
| `UnboundReactLayerError` | Neither a `components` entry nor an importable module covers the layer's path. |
| `UnregisteredLayerRendererError` | No renderer was registered for `text/tsx`/`text/jsx` at all — pass `renderers: reactLayerRenderers(...)`. |
| An **inline** layer declares `text/tsx`/`text/jsx` | Rejected at artifact validation — make it a file layer. |
| `AmbiguousSigningMarkError` | Two `Signature` blocks for the same party and field type. |
| `MissingSigningMarkerError` | A seal pass produced a PDF with no marker codepoint for a slot — almost always a font/glyph-coverage problem in a customized renderer setup, not something a composition author should hit with the shipped `Signature` component. |
