/**
 * Shape of one shadcn registry item, as committed under `public/r/{name}.json`
 * by `pnpm registry:build` in `paradoc/packages/components`. Kept here, not
 * inferred, because the generated content module (`src/generated/`) needs a
 * type to import without pulling in the generator itself.
 */
export interface RegistryFile {
  path: string;
  type: string;
  target?: string;
  content?: string;
}

export interface RegistryItem {
  $schema?: string;
  name: string;
  type: string;
  title?: string;
  description?: string;
  dependencies?: string[];
  registryDependencies?: string[];
  files: RegistryFile[];
}

/**
 * One row of a component's Usage props table, derived mechanically from its
 * exported props interface (see `scripts/sync-component-docs-content.ts`),
 * never hand-typed.
 */
export interface PropRow {
  name: string;
  type: string;
  optional: boolean;
  /** The `@default` JSDoc tag's text, when the prop declares one. */
  defaultValue: string | null;
  /** The property's JSDoc description, when it has one. */
  description: string;
}
