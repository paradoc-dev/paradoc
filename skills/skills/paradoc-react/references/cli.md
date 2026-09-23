---
name: cli
description: The paradoc commands for compositions - check (find faults without rendering), dev (live preview beside the PDF), add (install components and blocks) - the discovery rules that pair a composition with its artifact and sample, and why paradoc render does not render React layers.
metadata:
  tags: cli, paradoc check, paradoc dev, paradoc add, discovery, components.json, registry, blocks
---

# CLI for compositions

**Contents:** [Commands](#commands) · [Discovery](#discovery) ·
[paradoc check](#paradoc-check) · [paradoc dev](#paradoc-dev) ·
[paradoc add](#paradoc-add) · [Blocks](#blocks) ·
[paradoc render](#paradoc-render)

Run a command as `paradoc <command>`, or `npx paradoc-cli <command>` when the
CLI is not installed.

## Commands

| Command | Does | Finish line |
|---|---|---|
| `paradoc check <composition-or-artifact>` | Walks the tree a render walks and reports faults. Writes no PDF | Exit 0 |
| `paradoc dev [dir]` | Serves every composition live with its sample data, beside the PDF from the same tree | The composition lists with no `!` problems |
| `paradoc add <name...>` | Installs document components or blocks through the shadcn CLI | Files land in `components/paradoc/` |
| `paradoc renderers install react` | Installs the package `paradoc check` needs, ahead of first use | `paradoc renderers status` shows it installed |

## Discovery

`paradoc check` and `paradoc dev` pair files by these rules:

| Question | Rule |
|---|---|
| What is a composition | `paradoc dev`: a `.tsx`/`.jsx` file under a `compositions/` directory, not `*.sample.*`, `*.test.*`, `*.spec.*`, `*.stories.*`. `paradoc check`: any file you name |
| Its artifact | A `.yaml`, `.yml` or `.json` file with `kind: form` whose `text/tsx`/`text/jsx` layer `path` resolves to the composition. If none, an artifact file of the same name beside it (`purchase-order.tsx` + `purchase-order.json`) |
| Artifact rules | The artifact must pass `validate` with the current `$schema`. A `.ts` artifact module is never found |
| Search root | `paradoc check`: the directory with `paradoc.json` and `.paradoc`, else the working directory. `paradoc dev`: `[dir]`, default the working directory |
| Its sample data | A sibling `<name>.sample.{ts,tsx,js,mjs,jsx}` default export (a `DocumentData`, or a function that returns one). Else a named `sample` export on the composition |

When the artifact is authored in TypeScript, save it as JSON beside the
composition:

```ts
// export-artifact.ts
import { writeFile } from 'node:fs/promises'
import { agreement } from './documents/agreement'

await writeFile('compositions/agreement.json', JSON.stringify(agreement.toJSON(), null, 2) + '\n')
```

`toJSON()` writes the current `$schema`. A sample file:

```ts
// compositions/agreement-document.sample.ts
import type { DocumentData } from '@paradoc/react'

export default {
  fields: { service: 'Website redesign', fee: { amount: 4800, currency: 'USD' } },
  parties: { client: { name: 'Ada Lovelace' } },
} satisfies DocumentData
```

With no sample, the check runs with empty fields and parties. Every path still
resolves against the artifact.

## paradoc check

Pass the composition or the artifact that declares it:

```bash
paradoc check compositions/agreement-document.tsx
paradoc check compositions/agreement.json
```

| Flag | Purpose |
|---|---|
| `--layer <key>` | The React layer to check, when there are several, or when several artifacts point at one composition |
| `--data <pathOrJson>` | Sample data (file path or inline JSON). Overrides the discovered sample |
| `--adapter <takumi\|chromium>` | Class vocabulary to check against. Default `takumi`. `chromium` skips the class check |

A clean run:

```text
Composition: /abs/path/compositions/agreement-document.tsx
Artifact:    /abs/path/compositions/agreement.json

✓ No unsupported classes, unresolved paths, or missing images.
```

A run with faults lists every offender in three groups. Paths print absolute:

```text
Unsupported classes (1):
  - text-[13px] — /abs/path/compositions/agreement-document.tsx

Unresolved field paths (1):
  - servce — /abs/path/compositions/agreement.json

Images with no embedded bytes (1):
  - logo.png — /abs/path/compositions/agreement-document.tsx
```

The command exits 1 when any group is non-empty, images included. Replace each
class with its substitute in
[safe-classes.md § Commonly used, refused](./safe-classes.md#commonly-used-refused),
fix each path against the artifact's fields, and give each image a `data:` URI
or bytes at render time.

**Runtime.** The check loads `.tsx` through `tsx`, with the composition's
nearest `tsconfig.json`, so `@/` aliases resolve. On first use it downloads its
React renderer into `~/.paradoc/renderers`, which needs the network.
<!-- dep:R4 -->

### From code

`@paradoc/react-pdf/check` runs the same check in tests and CI:

```ts
import { checkComposition } from '@paradoc/react-pdf/check'
import { agreement } from './compositions/agreement'
import AgreementDocument from './compositions/agreement-document'
import sample from './compositions/agreement-document.sample'

const result = await checkComposition({
  artifact: agreement.toJSON(),
  composition: AgreementDocument,
  data: sample,
})
if (result.unsupportedClasses.length + result.unresolvedPaths.length > 0) process.exitCode = 1
```

It returns `{ unsupportedClasses, unresolvedPaths, missingImages }`.
`checkElement(element, { adapter })` checks an element you already built.
`missingImages` fails only if you will not supply those bytes at render time.

## paradoc dev

```bash
paradoc dev            # serve http://127.0.0.1:5180
paradoc dev --list     # print what was found, then exit
```

| Flag | Purpose |
|---|---|
| `--port <number>` | Port. Default `5180` |
| `--host <host>` | Address. Default `127.0.0.1` |
| `--open` | Open a browser |
| `--list` | Print each composition, its artifact and layer, and its sample, then exit |
| `--json` | With `--list`, print JSON |

`--list` output for one composition:

```text
compositions/agreement-document.tsx → compositions/agreement.json#composition · compositions/agreement-document.sample.ts
```

The preview compiles the project's source with the project's own toolchain.
Install these in the project first:

<!-- dep:R4 -->
```bash
npm install @paradoc/react react react-dom
npm install -D vite @vitejs/plugin-react @tailwindcss/vite tailwindcss
```

A missing package stops the command with the exact install line. With no
composition under `compositions/`, it exits 1. The preview runs every module a
composition imports in the browser. To load the artifact there, see
[render-and-seal.md § Load the artifact](./render-and-seal.md#load-the-artifact).

## paradoc add

`paradoc add` installs components through the shadcn CLI. The project needs a
`components.json`:

```bash
npx shadcn@latest init        # once, if components.json is missing
paradoc add document field signature
```

The first run writes the `@paradoc` namespace into `components.json`, then runs
`npx shadcn@4 add @paradoc/<name> --yes` for each item. Dependencies come
along: `field` brings `keep-together`, `document` brings `document-styles`.

| Flag | Purpose |
|---|---|
| `--registry <url>` | Registry URL template for `@paradoc`. Must contain `{name}` |
| `--dry-run` | Print the install command instead of running it |

| Message | Fix |
|---|---|
| `No components.json found.` | Run `npx shadcn@latest init` in the front-end project root |
| `components.json already maps @paradoc to a different registry.` | Point `registries["@paradoc"]` at the URL you want, or install with the full URL |
| `Not a document component: ...` | Several targets in one call must all be component names. Add an artifact (`@ns/name`) in its own call |
| `Registry URL must contain {name}` | Add the `{name}` placeholder to `--registry` |

A bare name is a component. `@namespace/name` or a URL is an artifact, added
from an artifact registry (see the `paradoc` skill).

Installable items:

| Kind | Names |
|---|---|
| Components | `bundle` `document` `field` `image` `keep-together` `list` `page-break` `page-number` `pages` `paper` `part` `party` `pdf-pages` `qr-code` `section` `signature` `table` `text` `totals` |
| Presets | `document-styles` (Tailwind preset, installs `styles/paradoc.css`), `priced-line-items` |
| Blocks | `purchase-order` `invoice` `engagement-letter` `vendor-packet` |

Installed files are the project's own source. Edit them freely: the runtime
parts stay in `@paradoc/react`.

**Without `paradoc add`.** Add the namespace to `components.json` by hand, then
use the shadcn CLI:

```json
{
  "registries": {
    "@paradoc": "https://docs.paradoc.dev/r/{name}.json"
  }
}
```

```bash
npx shadcn@4 add @paradoc/field
npx shadcn@4 add https://docs.paradoc.dev/r/field.json   # no registries entry needed
```

`https://docs.paradoc.dev/r/registry.json` indexes every item with its type,
dependencies, and files.

## Blocks

A block installs a whole document:

| File | Location |
|---|---|
| Composition | `components/paradoc/<name>.tsx` (default export) |
| Artifact module | `artifacts/paradoc/<name>.artifact.ts` |
| Sample data module | `artifacts/paradoc/<name>.data.ts` |

The artifact is a TypeScript module and the composition is not under
`compositions/`, so `paradoc check` and `paradoc dev` do not pair a block as
installed. Check it from code with `checkComposition`, or preview it by saving
the artifact as JSON beside a copy of the composition under `compositions/`.

A block's layer `path` names its source file (for example
`invoice-document.tsx`), not the installed name. Bind it at render time by the
layer key: `reactLayerRenderers({ components: { composition: InvoiceDocument } })`.

## paradoc render

`paradoc render` does not render React layers. It has no React renderer, so a
`text/tsx` layer fails with `Layer "composition" has MIME type text/tsx and no
renderer is registered for it`. Make the PDF with a Node script that calls
`render({ renderers: reactLayerRenderers(...) })` or `renderPdf`
([render-and-seal.md § Render through the layer](./render-and-seal.md#render-through-the-layer)),
or view it in `paradoc dev`.
