# `@paradoc/components`

This private workspace owns the source files distributed as copyable Paradoc document components. They use `@paradoc/react` for artifact state, formatting, pagination, signing, and rendering contracts; their markup and Tailwind classes remain in the consumer's project after installation.

The package is private because applications install these files through the Paradoc component catalog rather than importing a versioned UI library. Until the catalog migration is complete, the existing registry generator continues to read its legacy sources from `@paradoc/react`.
