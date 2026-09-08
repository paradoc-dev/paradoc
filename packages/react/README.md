# @paradoc/react

Headless React bindings for Paradoc artifacts, document settings, pagination, signing, and packet previews. The package supplies maintained behavior without choosing visible markup or shipping a stylesheet.

## Install

```sh
npm install @paradoc/react react
```

The root entry requires no Tailwind setup, font package, PDF engine, viewer, or external state library. It uses React context to scope each document store and `useSyncExternalStore` for focused subscriptions.

## Headless document markup

```tsx
import { ArtifactProvider, useField, type DocumentData } from "@paradoc/react";
import type { Form } from "@paradoc/types";

function Name() {
  const name = useField("name");
  return <p>{name.label}: {name.text}</p>;
}

export function Profile({ artifact, data }: { artifact: Form; data: DocumentData }) {
  return <ArtifactProvider artifact={artifact} data={data}><Name /></ArtifactProvider>;
}
```

Providers emit no styled DOM. Focused hooks expose data and correctness bindings:

- `useField`, `useList`, `useTotals`, `useParty`, and `useFormatter`
- `useDocumentSettings`, `useDocumentTokens`, and `usePaperGeometry`
- `usePagination`, `usePage`, `usePagePlan`, and visibility bindings
- `useSignature`, `resolvePartPlacement`, and `usePdfPages`
- `useFitToWidth` for consumer-owned page furniture

Inputs are immutable snapshots. A provider update publishes only selectors whose resolved value changed. Each provider creates an isolated store, including during SSR, and subscriptions clean up normally under Strict Mode.

## Copyable document components

Visible document components are source you own. Configure the Paradoc component collection in `components.json`, then use the stock shadcn CLI:

```sh
npx shadcn@latest add @paradoc/document @paradoc/field @paradoc/pages
```

`document` installs the optional `document-styles` preset at `styles/paradoc.css`. Import that file from the application entry when you want the default Tailwind presentation. You may instead copy the canonical files from `packages/components/src/components` and provide all markup and styles yourself.

Installed components import maintained logic from `@paradoc/react` and local sibling components. Updating the runtime can therefore fix bindings without replacing customized source. The CLI never overwrites an edited component unless you pass `--overwrite` explicitly.

## Rendering integrations

Install `@paradoc/react-pdf` only when an application needs composition checks, PDF rendering, layer renderers, or the experimental Chromium adapter:

```ts
import { renderPdf } from "@paradoc/react-pdf";
import { checkComposition } from "@paradoc/react-pdf/check";
```

The root package remains browser-safe and does not load rendering engines or font files. Composition discovery remains available from `@paradoc/react/discovery` for authoring tools.
