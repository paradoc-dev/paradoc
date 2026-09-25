---
name: paradoc-react
description: >
  Paradoc documents written in React (compositions) with @paradoc/react and
  @paradoc/react-pdf: compose, check, preview, render, and seal them. Use when
  writing a .tsx/.jsx composition or a text/tsx layer, calling renderPdf or
  reactLayerRenderers, running paradoc check, dev, or add, installing blocks
  (invoice, purchase order, engagement letter, vendor packet), or adding page
  headers, footers, page numbers, or watermarks. For the artifact itself,
  filling a PDF template, or signing after the seal, use the paradoc skill.
metadata:
  author: paradoc
  version: "0.6.0"
  tags: paradoc, react, composition, pdf, pagination, registry, seal
  license: MIT
allowed-tools: "Bash(npx:*) Bash(node:*) Bash(pnpm:*) Bash(paradoc:*) Read Write Edit Glob Grep"
---

# Paradoc React

A **composition** is a React component that lays out one Paradoc form artifact. The same tree renders in the browser and as a PDF. The artifact supplies every value; the composition controls only the page layout.

## Core rules

- Every value comes from the artifact. `Field`, `Table`, `Totals` and `Signature` name a path, a def or a party.
- The composition is the module's default export, typed with `ReactLayerComponentProps`.
- Keep the import graph browser-safe: the composition and everything it imports run in a browser, so read the artifact from props.
- Use only classes in the **verified vocabulary** ([safe-classes.md](./references/safe-classes.md)). Build tables with `Table`.
- A **keep** stays on one page and holds no other keep. Give each keep a unique, stable id.
- Page geometry and branding tokens are set once, on the outermost `Document` or `Bundle`. A wrapper that forwards `tokens` calls `markDocumentRoot`.
<!-- dep:R4 -->
- PDF APIs come from `@paradoc/react-pdf`: `renderPdf`, `reactLayerRenderers`, `isSupportedClass`. `checkComposition` and `checkElement` come from `@paradoc/react-pdf/check`.

## Lifecycle

Do the steps in order. Each ends on a result you can check.

1. **Install.** With a `components.json` in place, run `paradoc add document-styles pages document field table signature`, or install a block with its shared substrate, such as `paradoc add document-styles pages invoice`. See [cli.md § paradoc add](./references/cli.md#paradoc-add).
   Done when the component files exist under your components folder.
2. **Declare the layer.** Add a file layer with `mimeType: "text/tsx"` whose `path` names the composition module. See [render-and-seal.md § Declare the layer](./references/render-and-seal.md#declare-the-layer).
   Done when `npx paradoc-cli validate <artifact>` exits 0.
3. **Compose.** Write the default export with the components in [components.md](./references/components.md). Before writing your own component, load [custom-components.md](./references/custom-components.md).
   Done when every value on the page comes from a `Field`, `Table`, `Totals`, `Party` or `Signature` path.
4. **Check.** `paradoc check <composition>` finds unsupported classes, unresolved paths and missing images without rendering. See [cli.md § paradoc check](./references/cli.md#paradoc-check).
   Done when it exits 0.
5. **Preview.** `paradoc dev` needs `components/paradoc/pages.tsx` (`paradoc add pages`) and serves every composition under `compositions/` beside its PDF. In an app, wrap the composition in `<Pages onPaginate>`. See [cli.md § paradoc dev](./references/cli.md#paradoc-dev).
   Done when the composition is listed with no `!`.
6. **Render.** `renderPdf(element, { plan, furniture })`, or render through the artifact with `reactLayerRenderers`. Pass the preview's `plan` when the PDF must break where the preview broke. See [render-and-seal.md](./references/render-and-seal.md#render-through-the-layer).
   Done when you have bytes and `unknownBreaks` and `unknownRepeats` are empty.
7. **Seal signed documents.** Fill the form, add signers and signatories, then call `seal({ renderers })`. See [render-and-seal.md § Seal](./references/render-and-seal.md#seal).
   Done when `signatureMap` has one entry per slot.

Render React layers with `renderPdf` or the layer renderers; `paradoc render` handles only the other layer kinds.

## References

| Task | Load |
|------|------|
| Component props, defaults, errors, partial mode | [references/components.md](./references/components.md) |
| Page breaks, keeps, keep-with-next, header repeat, footers, plans | [references/pagination.md](./references/pagination.md) |
| Which classes render, common classes that are refused, branding tokens | [references/safe-classes.md](./references/safe-classes.md) |
| Writing your own component: hooks, hand-built keeps, `markDocumentRoot`, page counters | [references/custom-components.md](./references/custom-components.md) |
| The React layer, loading the artifact, `renderPdf`, adapters, preview plans, drafts, sealing, packets, errors | [references/render-and-seal.md](./references/render-and-seal.md) |
| `paradoc check`, `dev`, `add`, how they find the artifact, blocks | [references/cli.md](./references/cli.md) |

The artifact's fields, parties, defs and logic belong to the `paradoc` skill.
