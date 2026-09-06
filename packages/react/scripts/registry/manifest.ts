/**
 * What the registry ships, and what each item is made of.
 *
 * A component is not a file. `paper.tsx` carries `Paper`, `Sheet` and
 * `useFitToWidth`; `pages.tsx` carries `Page` and `Pages`; the four context
 * modules carry no component at all. Nor is a file one kind of thing: a block
 * is an artifact's JSON, a composition that binds it and a module of sample
 * data. So the registry is described here rather than inferred from the
 * directory listing: this manifest names the items, the files that travel with
 * each one, where each file lands, and the npm packages an installed file
 * needs. The generator reads it and reads the sources; nothing about the
 * emitted registry is written by hand.
 *
 * What an item does NOT carry is the substrate. The document, page, token and
 * signing contexts, the page plan, the measuring pass, the token resolution and
 * the serializer-backed formatter stay in `@paradoc/react` and are imported
 * from it, because a copied context is a different context: a `KeepTogether`
 * reading its own copy of the page context would never see the page `Pages` is
 * rendering. The installed file is the markup you own; the substrate underneath
 * it is the package you depend on.
 */

/** The npm package every installed component imports its substrate from. */
export const SUBSTRATE_PACKAGE = "@paradoc/react";

/** The shadcn registry namespace consumers register in `components.json`. */
export const REGISTRY_NAMESPACE = "@paradoc";

/** Where the registry is served from. */
export const REGISTRY_HOMEPAGE = "https://docs.paradoc.dev";

/** The directory an item installs into, under the consumer's project root. */
export const INSTALL_DIR = "components/paradoc";

/**
 * The import alias an installed file uses to reach its sibling items. Every
 * shadcn project defines `@/` in its `tsconfig` paths; `components.json` names
 * the components directory with the same prefix.
 */
export const INSTALL_ALIAS = `@/${INSTALL_DIR}`;

/**
 * shadcn's file types. A component is `registry:ui`; a helper the consumer owns
 * is `registry:lib`; anything that is not code the CLI understands — an
 * artifact's JSON, a sample data module — is `registry:file`, which is why a
 * file names its own type rather than inheriting the item's.
 */
export type RegistryFileType =
  | "registry:ui"
  | "registry:lib"
  | "registry:block"
  | "registry:component"
  | "registry:hook"
  | "registry:file";

/** The type an item as a whole takes. */
export type RegistryItemType = "registry:ui" | "registry:lib" | "registry:block";

/**
 * One file inside an item.
 *
 * A file names its own type and its own install target rather than having them
 * derived from the item or from the base name, because a block is not one file
 * of one kind: a purchase order is an artifact's JSON, a composition that binds
 * it, and a module of sample data, and the three do not land in the same place
 * or mean the same thing to the CLI.
 */
export interface RegistryManifestFile {
  /** Source, relative to `src/`. */
  path: string;
  /** shadcn file type. */
  type: RegistryFileType;
  /** Where it installs, relative to the consumer's project root. */
  target: string;
}

/** One registry item. */
export interface RegistryManifestItem {
  /** Item name. `shadcn add @paradoc/<name>`. */
  name: string;
  /** shadcn item type. */
  type: RegistryItemType;
  /** Human title shown by the CLI and the docs listing. */
  title: string;
  /** One line saying what the item is. */
  description: string;
  /** Sources that travel with the item. */
  files: RegistryManifestFile[];
  /**
   * npm packages the installed files import, beyond `react`. A `@paradoc/*`
   * entry is emitted with this package's own version, because the packages move
   * in lockstep and an installed component is written against one of them.
   */
  dependencies: string[];
  /** Other items in this registry the installed files import. */
  registryDependencies: string[];
}

/**
 * The one npm package an installed file may import without declaring it.
 *
 * Every React project already has it, and every component here imports it, so
 * naming it on all ten items would be noise rather than information.
 */
export const IMPLICIT_DEPENDENCIES = ["react"] as const;

/** One component file, installed into the framework's folder under its own name. */
function component(name: string): RegistryManifestFile {
  return {
    path: `components/${name}.tsx`,
    type: "registry:ui",
    target: `${INSTALL_DIR}/${name}.tsx`,
  };
}

/**
 * The items, in install order: the substrate-free ones first, then what depends
 * on them. Order is what the docs listing renders and what the index carries.
 */
export const REGISTRY_ITEMS: readonly RegistryManifestItem[] = [
  {
    name: "keep-together",
    type: "registry:ui",
    title: "Keep Together",
    description:
      "The pagination unit. Content inside one is never split across a page break, and renders only on the page the plan put it on.",
    files: [component("keep-together")],
    dependencies: [SUBSTRATE_PACKAGE],
    registryDependencies: [],
  },
  {
    name: "document",
    type: "registry:ui",
    title: "Document",
    description:
      "Binds one form artifact and its data to the components beneath it. The only component that knows how the artifact is loaded.",
    files: [component("document")],
    dependencies: [SUBSTRATE_PACKAGE, "@paradoc/core", "@paradoc/types"],
    registryDependencies: [],
  },
  {
    name: "bundle",
    type: "registry:ui",
    title: "Bundle",
    description:
      "Groups the documents of one composition, mirroring the artifact hierarchy's outermost level.",
    files: [component("bundle")],
    dependencies: [SUBSTRATE_PACKAGE],
    registryDependencies: [],
  },
  {
    name: "part",
    type: "registry:ui",
    title: "Part",
    description:
      "One document of a packet. It is the boundary between them, so each numbers its own pages and says where it sits in the packet.",
    files: [component("part")],
    dependencies: [SUBSTRATE_PACKAGE],
    registryDependencies: [],
  },
  {
    name: "pdf-pages",
    type: "registry:ui",
    title: "PDF Pages",
    description:
      "A PDF part of a packet, painted page by page at its own paper size, or a named attachment card when it cannot be painted.",
    files: [component("pdf-pages")],
    dependencies: [SUBSTRATE_PACKAGE],
    registryDependencies: ["paper"],
  },
  {
    name: "paper",
    type: "registry:ui",
    title: "Paper",
    description:
      "One sheet at the document's page geometry, the scaled sheet the preview lays out, and the fit-to-width hook.",
    files: [component("paper")],
    dependencies: [SUBSTRATE_PACKAGE],
    registryDependencies: [],
  },
  {
    name: "pages",
    type: "registry:ui",
    title: "Pages",
    description:
      "Measures the document once and lays it out as paginated sheets. One tree, rendered once per page.",
    files: [component("pages")],
    dependencies: [SUBSTRATE_PACKAGE],
    registryDependencies: ["paper"],
  },
  {
    name: "section",
    type: "registry:ui",
    title: "Section",
    description:
      "A titled container. It collapses on the pages that hold none of its keeps, so a continued page carries no empty heading.",
    files: [component("section")],
    dependencies: [SUBSTRATE_PACKAGE],
    registryDependencies: ["keep-together"],
  },
  {
    name: "field",
    type: "registry:ui",
    title: "Field",
    description:
      "One labelled value at a path into the artifact, printed by the artifact's serializers. It never formats a value itself.",
    files: [component("field")],
    dependencies: [SUBSTRATE_PACKAGE],
    registryDependencies: ["keep-together"],
  },
  {
    name: "table",
    type: "registry:ui",
    title: "Table",
    description:
      "A list field as rows. Each row is its own pagination unit and the header repeats on every page the table continues onto.",
    files: [component("table")],
    dependencies: [SUBSTRATE_PACKAGE],
    registryDependencies: ["keep-together"],
  },
  {
    name: "totals",
    type: "registry:ui",
    title: "Totals",
    description:
      "The artifact's computed amounts, evaluated by @paradoc/core and printed by the serializer each def's type names.",
    files: [component("totals")],
    dependencies: [SUBSTRATE_PACKAGE],
    registryDependencies: ["keep-together"],
  },
  {
    name: "signature",
    type: "registry:ui",
    title: "Signature",
    description:
      "A party's signing block. Its rule is the placeholder the core seal measures a flow-placed signature field from.",
    files: [component("signature")],
    dependencies: [SUBSTRATE_PACKAGE],
    registryDependencies: ["keep-together"],
  },
];
