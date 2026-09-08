/**
 * What the registry ships, and what each item is made of.
 *
 * A component is not a file. `paper.tsx` carries `Paper`, `Sheet` and
 * `useFitToWidth`; `pages.tsx` carries `Page` and `Pages`; the four context
 * modules carry no component at all. Nor is a file one kind of thing: a block
 * is an artifact, a composition that binds it and a module of sample data, and
 * the three do not land in the same folder. So the registry is described here
 * rather than inferred from the directory listing: this manifest names the
 * items, the files that travel with each one, where each file lands, and the
 * npm packages an installed file needs. The generator reads it and reads the
 * sources; nothing about the emitted registry is written by hand.
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
 * Where a block's artifact and its sample data install.
 *
 * Not beside the components, because they are not components. An artifact is
 * the document's definition and its sample data is a value; both are read by
 * the composition and by anything else in the project that renders, fills or
 * seals the same document. Keeping them out of the components folder is what
 * lets a consumer delete or rewrite the markup without touching the artifact.
 */
export const ARTIFACT_DIR = "artifacts/paradoc";

/**
 * shadcn's file types. A component is `registry:ui`; a helper the consumer owns
 * is `registry:lib`; anything that is not code the CLI understands — an
 * artifact, a sample data module — is `registry:file`, which is why a file
 * names its own type rather than inheriting the item's.
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
 * of one kind: a purchase order is an artifact, a composition that binds it,
 * and a module of sample data, and the three do not land in the same place or
 * mean the same thing to the CLI.
 */
export interface RegistryManifestFile {
  /** Source, relative to `src/`. */
  path: string;
  /** shadcn file type. */
  type: RegistryFileType;
  /** Where it installs, relative to the consumer's project root. */
  target: string;
  /**
   * A binary file, relative to `src/`, whose bytes are this file's content.
   *
   * A registry item is JSON and a registry file is text, so an item cannot ship
   * a PDF. The vendor packet needs one anyway: its annex is a document the
   * vendor supplied, and a block installed into a browser project has no engine
   * to draw a substitute with. So the generator reads those bytes and emits a
   * module that carries them, and `path` names the module rather than the PDF.
   * `pnpm registry:build` writes the same module into `src/`, which is what the
   * package and the block's own sample import; the freshness test regenerates
   * both and fails on a difference, so neither is edited by hand.
   */
  bytesFrom?: {
    /** The binary file, relative to `src/`. */
    path: string;
    /** The name the emitted module exports the bytes under. */
    binding: string;
    /** One line saying what the bytes are, which the module's doc repeats. */
    describe: string;
  };
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
   * entry is emitted with the public runtime version. This private source
   * workspace has no publish version of its own.
   */
  dependencies: string[];
  /** Other items in this registry the installed files import. */
  registryDependencies: string[];
}

/**
 * The one npm package an installed file may import without declaring it.
 *
 * Every React project already has it, and every component here imports it, so
 * naming it on every item would be noise rather than information.
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
 * A block's composition, installed under the block's own name.
 *
 * The source is the sample's `*-document.tsx`; the installed file is named for
 * the block, because in a consumer's project the block is the document and
 * `purchase-order.tsx` is what they will look for.
 */
function composition(block: string, source: string): RegistryManifestFile {
  return {
    path: `examples/${source}.tsx`,
    type: "registry:component",
    target: `${INSTALL_DIR}/${block}.tsx`,
  };
}

/**
 * An artifact or a module of sample data, installed where artifacts go.
 *
 * `installedAs` is stated rather than derived, and it never repeats an item's
 * name, because the shadcn CLI resolves an import by the item it appears to
 * name: a specifier whose last segment is an installed item's name is rewritten
 * to that item's place in the components folder, whatever target the manifest
 * gave the file. So the purchase order's artifact installs as
 * `purchase-order.artifact.ts`, not `purchase-order.ts`, or the packet's import
 * of it would be pointed at the composition. `generateRegistry` refuses a
 * manifest that gets this wrong.
 */
function artifactFile(source: string, installedAs: string): RegistryManifestFile {
  return {
    path: `examples/${source}.ts`,
    type: "registry:file",
    target: `${ARTIFACT_DIR}/${installedAs}.ts`,
  };
}

/**
 * A module generated from a binary file, installed where artifacts go.
 *
 * `source` names the module `pnpm registry:build` writes into `src/`, which is
 * what the package and the block's own sample import; `binary` is the file it
 * carries. Same naming rule as `artifactFile`.
 */
function bytesFile(
  source: string,
  installedAs: string,
  bytesFrom: { path: string; binding: string; describe: string }
): RegistryManifestFile {
  return {
    path: `examples/${source}.ts`,
    type: "registry:file",
    target: `${ARTIFACT_DIR}/${installedAs}.ts`,
    bytesFrom: { ...bytesFrom, path: `examples/${bytesFrom.path}` },
  };
}

/**
 * The items, in install order: the substrate-free ones first, then what depends
 * on them. Order is what the docs listing renders and what the index carries.
 */
export const REGISTRY_ITEMS: readonly RegistryManifestItem[] = [
  {
    name: "document-styles",
    type: "registry:lib",
    title: "Document Styles",
    description: "Tailwind entry and font faces shared by document preview and PDF output.",
    files: [{ path: "styles.css", type: "registry:file", target: "styles/paradoc.css" }],
    dependencies: [
      "@fontsource-variable/inter",
      "@fontsource-variable/noto-sans-arabic",
      "@fontsource-variable/source-serif-4",
    ],
    registryDependencies: [],
  },
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
    registryDependencies: ["document-styles"],
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
  {
    name: "purchase-order",
    type: "registry:block",
    title: "Purchase Order",
    description:
      "A whole document: the purchase order artifact with its React layer, the composition that binds it, and a sample order that runs to three pages.",
    files: [
      artifactFile("purchase-order", "purchase-order.artifact"),
      artifactFile("purchase-order-data", "purchase-order.data"),
      composition("purchase-order", "purchase-order-document"),
    ],
    // `@paradoc/core` parses the artifact and `@paradoc/types` is what it is.
    dependencies: [SUBSTRATE_PACKAGE, "@paradoc/core", "@paradoc/types"],
    // `pages` is imported by none of these files and is listed anyway: the
    // composition is a document, and a document that is never paginated is not
    // one. A consumer installing this block should be able to see it.
    registryDependencies: [
      "document",
      "field",
      "keep-together",
      "pages",
      "section",
      "signature",
      "table",
      "totals",
    ],
  },
  {
    name: "invoice",
    type: "registry:block",
    title: "Invoice",
    description:
      "A whole document nothing signs: the invoice artifact with its React layer, the composition that brands it from its own tokens, and two samples — one that fits a page and one whose table runs past two breaks.",
    files: [
      artifactFile("invoice", "invoice.artifact"),
      artifactFile("invoice-data", "invoice.data"),
      composition("invoice", "invoice-document"),
    ],
    // `@paradoc/core` parses the artifact and `@paradoc/types` is what it is.
    dependencies: [SUBSTRATE_PACKAGE, "@paradoc/core", "@paradoc/types"],
    // No `signature`: an invoice is a demand for payment rather than an
    // agreement, so the artifact declares no slot and the composition draws no
    // signing block. `pages` is imported by none of these files and is listed
    // for the reason the purchase order lists it: a document that is never
    // paginated is not one.
    registryDependencies: [
      "document",
      "field",
      "keep-together",
      "pages",
      "section",
      "table",
      "totals",
    ],
  },
  {
    name: "engagement-letter",
    type: "registry:block",
    title: "Engagement Letter",
    description:
      "A prose document: the engagement letter artifact with its React layer and two signature slots, the composition that renders its scope as numbered clauses, and one sample that runs to two pages.",
    files: [
      artifactFile("engagement-letter", "engagement-letter.artifact"),
      artifactFile("engagement-letter-data", "engagement-letter.data"),
      composition("engagement-letter", "engagement-letter-document"),
    ],
    dependencies: [SUBSTRATE_PACKAGE, "@paradoc/core", "@paradoc/types"],
    // No `table` and no `totals`: the letter prices nothing and lists nothing in
    // rows. What it does carry is `signature`, twice, and the clauses are plain
    // `keep-together` units the composition builds itself.
    registryDependencies: [
      "document",
      "field",
      "keep-together",
      "pages",
      "section",
      "signature",
    ],
  },
  {
    name: "vendor-packet",
    type: "registry:block",
    title: "Vendor Packet",
    description:
      "A packet of three documents: the purchase order composed live, a filled W-9 painted from its PDF layer, and the vendor's certificate of insurance as an annex, whose bytes it ships.",
    files: [
      artifactFile("vendor-packet", "vendor-packet.artifact"),
      bytesFile("vendor-packet-annex", "vendor-packet.annex", {
        path: "certificate-of-insurance.pdf",
        binding: "vendorPacketAnnexBytes",
        describe: "The certificate of insurance the vendor packet carries as its annex.",
      }),
      artifactFile("vendor-packet-data", "vendor-packet.data"),
      composition("vendor-packet", "vendor-packet-document"),
    ],
    // `@paradoc/essentials` is not imported by any of these files and is
    // declared anyway. The packet's second part is the IRS W-9, and the
    // installed packet cannot be filled or sealed without that artifact and its
    // resolver; the sample carries the taxpayer's values, not the form.
    dependencies: [
      SUBSTRATE_PACKAGE,
      "@paradoc/core",
      "@paradoc/types",
      "@paradoc/essentials",
    ],
    // The purchase order is a part of the packet, so the block installs it: the
    // packet's composition renders it and its bundle declares its artifact.
    registryDependencies: ["bundle", "pages", "part", "pdf-pages", "purchase-order"],
  },
];
