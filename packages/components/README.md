# `@paradoc/components`

This private workspace owns the source files distributed as copyable Paradoc document components. They use `@paradoc/react` for artifact state, formatting, pagination, signing, and rendering contracts; their markup and Tailwind classes remain in the consumer's project after installation.

The package is private because applications install these files through the Paradoc component collection rather than importing a versioned UI library.

```sh
npx shadcn@latest add @paradoc/document-styles @paradoc/pages @paradoc/document @paradoc/field
```

The stock CLI reads the `@paradoc` namespace from `components.json`, writes source into the configured project, and leaves it under the consumer's ownership. Install `document-styles` explicitly and import `@/styles/paradoc.css` once from the application stylesheet. Install `pages` explicitly when the app or `paradoc dev` needs the preview wrapper. The preset loads Tailwind only, so the installed component paths must remain in the application's Tailwind source scan. The consuming application supplies its own font faces and applies them to `.paradoc-document`.

Manual copying uses the same files under `src/components`. Copy the component and its local sibling imports, install the public packages named in `package.json`, copy `src/styles.css`, and import that stylesheet once. No build output from this private workspace is a runtime dependency.

Run `pnpm --filter @paradoc/components registry:build` after changing a component, block, artifact, asset, or preset. The generated JSON under `paradoc/apps/docs/public/r` is committed and checked for freshness.
