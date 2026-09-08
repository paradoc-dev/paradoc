# `@paradoc/components`

This private workspace owns the source files distributed as copyable Paradoc document components. They use `@paradoc/react` for artifact state, formatting, pagination, signing, and rendering contracts; their markup and Tailwind classes remain in the consumer's project after installation.

The package is private because applications install these files through the Paradoc component collection rather than importing a versioned UI library.

```sh
npx shadcn@latest add @paradoc/document @paradoc/field @paradoc/pages
```

The stock CLI reads the `@paradoc` namespace from `components.json`, writes source into the configured project, and leaves it under the consumer's ownership. `document` also installs `document-styles`; import `@/styles/paradoc.css` once from the application stylesheet. The preset loads the same font families the PDF integration embeds and includes Tailwind, so the installed component paths must remain in the application's Tailwind source scan.

Manual copying uses the same files under `src/components`. Copy the component and its local sibling imports, install the public packages named in `package.json`, copy `src/styles.css`, and import that stylesheet once. No build output from this private workspace is a runtime dependency.

Run `pnpm --filter @paradoc/components registry:build` after changing a component, block, artifact, asset, or preset. The generated JSON under `paradoc/apps/docs/public/r` is committed and checked for freshness.
