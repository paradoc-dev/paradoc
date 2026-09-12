/**
 * Reads for the component docs pages: the shadcn registry content behind
 * Installation, and the rewritten demo-fixture source and derived data
 * behind Preview, Usage and Variants.
 *
 * All of it comes from `src/generated/component-docs-content.ts`, which is
 * mechanically produced from real files (see `scripts/sync-component-docs-content.ts`)
 * and never hand-edited. A missing item fails loudly rather than rendering
 * stale or blank content, per the spec's failure-case invariant.
 */
import {
  PREVIEW_SOURCES,
  PROPS_TABLES,
  REGISTRY_CONTENT,
  USAGE_SNIPPETS,
  VARIANT_SOURCES,
} from "@/generated/component-docs-content";
import type { PropRow, RegistryFile, RegistryItem } from "@/lib/registry-types";

export function getRegistryItem(name: string): RegistryItem {
  const item = REGISTRY_CONTENT[name];
  if (!item) {
    throw new Error(
      `No shadcn registry item named "${name}". Run \`pnpm registry:build\` in ` +
        "paradoc/packages/components, then `pnpm sync:component-docs` (or `pnpm dev` / " +
        "`pnpm build`, which run it automatically) in paradoc/apps/docs.",
    );
  }
  return item;
}

/**
 * The demo composition's source, rewritten to consumer-style imports — what
 * Preview's Code tab shows next to the same demo rendered live.
 */
export function getPreviewSource(name: string): string {
  const source = PREVIEW_SOURCES[name];
  if (!source) {
    throw new Error(
      `No preview source for "${name}". Add it to DEMO_FILES in ` +
        "scripts/sync-component-docs-content.ts and to paradoc/packages/components/src/examples/.",
    );
  }
  return source;
}

/** The minimal import-and-call snippet Usage shows above the props table. */
export function getUsageSnippet(name: string): string {
  const snippet = USAGE_SNIPPETS[name];
  if (!snippet) {
    throw new Error(`No usage snippet for "${name}". Run \`pnpm sync:component-docs\`.`);
  }
  return snippet;
}

/** Usage's props table, derived from the component's own exported props interface. */
export function getPropsTable(name: string): PropRow[] {
  const props = PROPS_TABLES[name];
  if (!props) {
    throw new Error(
      `No props table for "${name}". Add it to PROPS_INTERFACES in ` +
        "scripts/sync-component-docs-content.ts.",
    );
  }
  return props;
}

/** One Variant's rewritten source, keyed by component name then variant key. */
export function getVariantSource(name: string, variant: string): string {
  const source = VARIANT_SOURCES[name]?.[variant];
  if (!source) {
    throw new Error(
      `No variant source for "${name}"/"${variant}". Add it to VARIANT_FILES in ` +
        "scripts/sync-component-docs-content.ts and to paradoc/packages/components/src/examples/.",
    );
  }
  return source;
}

export interface BlockUsageFiles {
  composition: RegistryFile;
  data: RegistryFile;
}

/**
 * The composition and sample-data files behind a block's Usage section, both
 * read from the same already-generated registry item Installation reads
 * (`REGISTRY_CONTENT`, mirroring `public/r/{name}.json`) — never extracted
 * or rewritten like a base component's Usage snippet, and never hand-typed.
 * A block has no single natural call site, so Usage shows both real,
 * currently-shipping files in full instead.
 */
export function getBlockUsageFiles(name: string): BlockUsageFiles {
  const item = getRegistryItem(name);
  const composition = item.files.find((file) => file.type === "registry:component");
  const data = item.files.find((file) => file.path.endsWith(".data.ts"));
  if (!composition?.content || !data?.content) {
    throw new Error(
      `Block "${name}" is missing its composition or sample-data file content. Run ` +
        "`pnpm registry:build` in paradoc/packages/components, then `pnpm sync:component-docs` " +
        "(or `pnpm dev` / `pnpm build`, which run it automatically) in paradoc/apps/docs.",
    );
  }
  return { composition, data };
}
