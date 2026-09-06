---
name: cli
description: para check (verify a composition without rendering) and para add / npx shadcn@4 add @paradoc/<name> (install a document component).
metadata:
  tags: cli, para, check, add, registry
---

# `para check` and `para add`

**Contents:** [Checking a composition](#checking-a-composition) ·
[Current limitations](#current-limitations) ·
[Installing components](#installing-components) ·
[The registry index](#the-registry-index)

## Checking a composition

`para check` walks the same tree the default PDF path walks and reports what
a render would refuse — **without producing PDF bytes**. Run it after
writing or editing a composition, before ever rendering it:

```bash
para check ./compositions/change-order.tsx
# or, equivalently, by the artifact that declares the layer:
para check ./artifacts/change-order.json
```

```
Composition: ./compositions/change-order.tsx
Artifact:    ./artifacts/change-order.json

✓ No unsupported classes, unresolved paths, or missing images.
```

A composition with faults reports all of them in one run, grouped by kind:

```
Unsupported classes (1):
  - text-[13px] — ./compositions/change-order.tsx

Unresolved field paths (1):
  - custommer — ./artifacts/change-order.json
```

Exit code is non-zero whenever any of `unsupportedClasses`,
`unresolvedPaths`, or `missingImages` is non-empty.

Options:

| Flag | Purpose |
|---|---|
| `--layer <key>` | Which React layer to check, when the artifact declares more than one. |
| `--data <pathOrJson>` | Sample data (a file path or inline JSON) that overrides discovered sample data. |
| `--adapter <takumi\|chromium>` | Which class vocabulary to check against. Defaults to `takumi`; `chromium` skips the class check entirely (see [safe-classes.md](./safe-classes.md#checking-against-a-different-adapter)). |

**Passing the composition file or the artifact file both work.** Passing the
composition searches the project for the one artifact whose React layer
resolves to that file; passing the artifact reads its declared layer
directly. If more than one artifact points at the same composition file, or
an artifact declares more than one React layer, name the layer with
`--layer`.

**Sample data discovery**, when `--data` is not given, is **sibling-first**:
a `<composition>.sample.ts`/`.tsx`/`.js`/`.mjs`/`.jsx` file next to the
composition (its default export — a `DocumentData`, or a function returning
one) wins if present; only when no sibling file exists does discovery fall
back to a named `sample` export on the composition module itself. Neither
found, the check still runs with empty fields and parties.

```ts
// change-order.sample.ts
import type { DocumentData } from "@paradoc/react";

export const sample: DocumentData = {
  fields: { customer: "Acme Co.", issuedOn: "2026-09-01", lineItems: [] },
  parties: {},
};
```

### Current limitations

Both of these are tracked and will be deleted from this reference once
`make-para-check-runnable-from-the-shipped-cli` ships:

- **A composition that uses `Totals` over a def needs sample data to check
  cleanly.** With no data, a def like `subtotal` evaluates to a value a
  money/percentage serializer rejects, and `checkComposition` throws that
  formatter error rather than reporting it as a fault — the check does not
  finish. Give `--data` or ship a sample (see above) for any composition with
  a `Totals` block, even a composition with no other faults to find.
- **Running `para check` on a `.tsx` composition needs a TypeScript-aware
  Node.** The shipped `para` binary has no TypeScript/JSX loader of its own,
  so `para check` on a real composition today needs to run under one, for
  example:
  ```bash
  npx tsx $(which para) check ./compositions/change-order.tsx
  ```

## Installing components

Components are shadcn registry items served at `docs.paradoc.dev`. Install
with the stock shadcn CLI:

```bash
npx shadcn@4 add @paradoc/field
```

or with `para add`, which registers the `@paradoc` namespace in the
project's `components.json` first (idempotent — safe to run repeatedly) and
then runs the same install:

```bash
para add field
```

**`para add` takes one name per invocation today** — it does not accept
several names in one call. Install more than one component with separate
commands:

```bash
para add field
para add table
para add signature
```

A component that depends on another brings it along automatically within a
single `para add`: installing `field` also installs `keep-together`, since
`field` is built on it.

Files land under `components/paradoc/<name>.tsx` and are the project's own
from that point — editing one is expected and safe, because the parts that
are **not** design decisions (contexts, the page plan, the measuring pass,
the serializer-backed formatter) stay in `@paradoc/react` and are imported by
the installed file, never copied into it.

**Every installable item**, by bare name (`para add <name>` /
`@paradoc/<name>`):

```
bundle  document  field  keep-together  pages  paper  section  signature  table  totals
```

A bare name not in that list, or an argument shaped like `@namespace/name`
or a URL, is treated as an **artifact** reference instead (a different
registry, for form artifacts like a W-9) — the two are told apart by shape,
never ambiguous.

Without a `components.json` entry, the full URL still works:

```bash
npx shadcn@4 add https://docs.paradoc.dev/r/field.json
```

## The registry index

`https://docs.paradoc.dev/r/registry.json` is a machine-readable index of
every item: name, `type` (`registry:ui`), title, description, dependencies,
and the files it installs. Fetch it directly to enumerate what is available
without scraping the docs page — for example, to decide which components a
composition needs before running `para add`. Each item's own JSON is at
`https://docs.paradoc.dev/r/{name}.json`.
