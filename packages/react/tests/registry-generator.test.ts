/**
 * The registry is generated from the sources, and this is what says so.
 *
 * Three claims are checked here. That the committed registry is what the
 * generator produces right now, so nobody edits the served JSON by hand. That
 * every component the package exports is an item, so a new component cannot be
 * added and quietly left out. And that the import rewrite is the checked kind:
 * an item that reaches for something the package does not export publicly fails
 * the build rather than shipping a file the consumer cannot compile.
 *
 * The install itself — the stock CLI, a scratch project, `tsc` over what lands
 * — is `tests/registry/install.test.ts`, which needs a server and a build and
 * so runs under its own script.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  buildRegistry,
  DEFAULT_OUT_DIR,
  collectPackageModules,
  packageVersion,
  registryFileNames,
} from "../scripts/build-registry";
import { generateRegistry, RegistryGenerationError } from "../scripts/registry/generate";
import {
  INSTALL_ALIAS,
  INSTALL_DIR,
  REGISTRY_ITEMS,
  SUBSTRATE_PACKAGE,
  type RegistryManifestFile,
} from "../scripts/registry/manifest";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(packageRoot, "src");
const entrySource = readFileSync(path.join(srcDir, "index.ts"), "utf8");

/** A manifest file entry for a source supplied inline. */
function probeFile(relPath: string): RegistryManifestFile {
  return {
    path: relPath,
    type: "registry:ui",
    target: `${INSTALL_DIR}/${path.posix.basename(relPath)}`,
  };
}

/** Generates one item from sources supplied inline, for the failure cases. */
function generateFrom(sources: Record<string, string>, item = REGISTRY_ITEMS[0]!) {
  return generateRegistry({
    srcDir,
    entrySource,
    items: [{ ...item, files: Object.keys(sources).map(probeFile) }],
    version: packageVersion(packageRoot),
    packageModules: [
      ...collectPackageModules(srcDir),
      ...Object.keys(sources).map((file) => file.replace(/\.tsx?$/, "")),
    ],
    readSource: (relPath) => sources[relPath] ?? "",
  });
}

describe("the committed registry", () => {
  const generated = registryFileNames(buildRegistry(packageRoot));

  it.each([...generated.keys()])("matches a fresh generation of %s", (name) => {
    const committed = readFileSync(path.join(DEFAULT_OUT_DIR, name), "utf8");
    expect(committed).toBe(generated.get(name));
  });
});

describe("the manifest covers the package", () => {
  /** The component modules the package's root entry re-exports from. */
  const exported = [...entrySource.matchAll(/from "\.\/components\/([a-z-]+)";/g)].map(
    (match) => match[1]
  );

  const carried = new Set(
    REGISTRY_ITEMS.flatMap((item) => item.files).map((file) =>
      path.posix.basename(file.path).replace(/\.tsx?$/, "")
    )
  );

  it("ships every exported component as an item", () => {
    // The contexts and the paper geometry are substrate, not components: a
    // copied context is a different context, so an installed `KeepTogether`
    // reading its own copy would never see the page `Pages` renders. They stay
    // in the package and are imported from it.
    const uncovered = exported.filter((name) => !carried.has(name ?? ""));
    expect(uncovered.sort()).toEqual([
      "document-context",
      "page-context",
      "paper-geometry",
      "signing-context",
      "tokens-context",
    ]);
  });

  it("carries no file twice", () => {
    const files = REGISTRY_ITEMS.flatMap((item) => item.files).map((file) => file.path);
    expect(new Set(files).size).toBe(files.length);
  });
});

describe("the emitted files", () => {
  const registry = buildRegistry(packageRoot);
  const byName = new Map(registry.items.map((item) => [item.name, item]));

  it("leaves no relative import behind", () => {
    for (const item of registry.items) {
      for (const file of item.files) {
        expect(file.content, `${item.name} ships a relative import`).not.toMatch(
          /^import[\s\S]*?from "\.\.?\//m
        );
      }
    }
  });

  it("points a sibling item at where that item installs", () => {
    expect(byName.get("field")?.files[0]?.content).toContain(
      `import { KeepTogether } from "${INSTALL_ALIAS}/keep-together";`
    );
  });

  it("takes the substrate from the package", () => {
    expect(byName.get("field")?.files[0]?.content).toContain(
      `import { useDocument } from "${SUBSTRATE_PACKAGE}";`
    );
  });

  it("merges two authoring imports that land on one specifier", () => {
    const signature = byName.get("signature")?.files[0]?.content ?? "";
    expect(signature).toContain(
      `import { formatByType, useDocument, type SigningMarkType } from "${SUBSTRATE_PACKAGE}";`
    );
    expect(signature.match(/from "@paradoc\/react";/g)).toHaveLength(1);
  });

  it("rewrites a re-export the same way, and keeps it a re-export", () => {
    // `paper.tsx` re-exports the drawn-paper context it does not own. Emitted
    // as written it would name a module the consumer has no copy of.
    const paper = byName.get("paper")?.files[0]?.content ?? "";
    expect(paper).toMatch(/export \{[\s\S]*?\} from "@paradoc\/react";/);
    expect(paper).toMatch(/import \{[\s\S]*?\} from "@paradoc\/react";/);
  });

  it("moves the module comment below the imports, where the CLI keeps it", () => {
    const field = byName.get("field")?.files[0]?.content ?? "";
    expect(field.indexOf("A field is a pagination unit")).toBeGreaterThan(
      field.indexOf(`from "${SUBSTRATE_PACKAGE}";`)
    );
  });

  it("installs into one folder, named for the framework", () => {
    for (const item of registry.items) {
      for (const file of item.files) {
        expect(file.target).toBe(`components/paradoc/${item.name}.tsx`);
      }
    }
  });

  it("names its registry dependencies in the namespace consumers registered", () => {
    expect(byName.get("field")?.registryDependencies).toEqual(["@paradoc/keep-together"]);
    expect(byName.get("keep-together")?.registryDependencies).toEqual([]);
  });

  it("pins every paradoc dependency to this package's version", () => {
    const version = packageVersion(packageRoot);
    expect(byName.get("field")?.dependencies).toEqual([`${SUBSTRATE_PACKAGE}@^${version}`]);
    expect(byName.get("document")?.dependencies).toEqual([
      `${SUBSTRATE_PACKAGE}@^${version}`,
      `@paradoc/core@^${version}`,
      `@paradoc/types@^${version}`,
    ]);

    // A consumer installing today and again in three releases would otherwise
    // get components written against two different substrates.
    for (const item of registry.items) {
      for (const dependency of item.dependencies) {
        if (dependency.startsWith("@paradoc/")) {
          expect(dependency).toContain(`@^${version}`);
        }
      }
    }
  });
});

describe("an item whose files do not install side by side", () => {
  // What a block is: an artifact's JSON where artifacts go, a composition that
  // binds it where components go. The path between them where they land is not
  // the path between them where they are authored.
  const built = generateRegistry({
    srcDir,
    entrySource,
    items: [
      {
        ...REGISTRY_ITEMS[0]!,
        name: "purchase-order",
        type: "registry:block",
        registryDependencies: [],
        dependencies: [SUBSTRATE_PACKAGE],
        files: [
          {
            path: "blocks/purchase-order.tsx",
            type: "registry:block",
            target: `${INSTALL_DIR}/purchase-order.tsx`,
          },
          {
            path: "blocks/purchase-order.json",
            type: "registry:file",
            target: "artifacts/paradoc/purchase-order.json",
          },
        ],
      },
    ],
    version: packageVersion(packageRoot),
    packageModules: [
      ...collectPackageModules(srcDir),
      "blocks/purchase-order",
      "blocks/purchase-order.json",
    ],
    readSource: (relPath) =>
      relPath.endsWith(".tsx")
        ? 'import { useDocument } from "../components/document-context";\nimport artifact from "./purchase-order.json";\n'
        : '{ "kind": "form" }\n',
  });

  const files = new Map(built.items[0]?.files.map((file) => [file.target, file]) ?? []);

  it("names a sibling by where the two land, not by how they were authored", () => {
    expect(files.get(`${INSTALL_DIR}/purchase-order.tsx`)?.content).toContain(
      'from "../../artifacts/paradoc/purchase-order.json";'
    );
  });

  it("still takes the substrate from the package", () => {
    expect(files.get(`${INSTALL_DIR}/purchase-order.tsx`)?.content).toContain(
      `import { useDocument } from "${SUBSTRATE_PACKAGE}";`
    );
  });

  it("ships a file that is not code exactly as it is authored", () => {
    expect(files.get("artifacts/paradoc/purchase-order.json")?.content).toBe('{ "kind": "form" }\n');
  });

  it("keeps each file's own shadcn type", () => {
    expect(files.get(`${INSTALL_DIR}/purchase-order.tsx`)?.type).toBe("registry:block");
    expect(files.get("artifacts/paradoc/purchase-order.json")?.type).toBe("registry:file");
  });
});

describe("the generator refuses what would not compile", () => {
  it("rejects a binding the package does not export publicly", () => {
    expect(() =>
      generateFrom({
        "components/probe.tsx": 'import { measureKeeps, privateHelper } from "../lib/measure";\n',
      })
    ).toThrow(/privateHelper/);
  });

  it("rejects a default import of the substrate, which exports names only", () => {
    expect(() =>
      generateFrom({ "components/probe.tsx": 'import measure from "../lib/measure";\n' })
    ).toThrow(/exports names only/);
  });

  it("rejects a namespace import of the substrate too", () => {
    expect(() =>
      generateFrom({ "components/probe.tsx": 'import * as measure from "../lib/measure";\n' })
    ).toThrow(RegistryGenerationError);
  });

  it("rejects a re-export of something the package does not export publicly", () => {
    expect(() =>
      generateFrom({
        "components/probe.tsx": 'export { privateHelper } from "../lib/measure";\n',
      })
    ).toThrow(/privateHelper/);
  });

  it("rejects a relative import that resolves to nothing", () => {
    expect(() =>
      generateFrom({ "components/probe.tsx": 'import { thing } from "../lib/nowhere";\n' })
    ).toThrow(/resolves to no module/);
  });

  it("rejects a sibling item the manifest did not declare a dependency on", () => {
    expect(() =>
      generateRegistry({
        srcDir,
        entrySource,
        items: [
          {
            ...REGISTRY_ITEMS[0]!,
            name: "one",
            files: [probeFile("components/one.tsx")],
            registryDependencies: [],
          },
          {
            ...REGISTRY_ITEMS[0]!,
            name: "two",
            files: [probeFile("components/two.tsx")],
            registryDependencies: [],
          },
        ],
        version: packageVersion(packageRoot),
        packageModules: ["components/one", "components/two"],
        readSource: (relPath) =>
          relPath === "components/one.tsx" ? 'import { Two } from "./two";\n' : "",
      })
    ).toThrow(/does not list "two" in registryDependencies/);
  });

  it("rejects an npm package an item imports but does not declare", () => {
    expect(() =>
      generateFrom({ "components/probe.tsx": 'import { z } from "zod";\n' })
    ).toThrow(/`zod`[\s\S]*does not list/);
  });

  it("reads a subpath import as its package, and lets `react` go undeclared", () => {
    // `react` is the one implicit dependency: every React project has it, and
    // every component here imports it.
    expect(() =>
      generateFrom({
        "components/probe.tsx": 'import { jsx } from "react/jsx-runtime";\n',
      })
    ).not.toThrow();
  });

  it("rejects a registry dependency it does not ship", () => {
    expect(() =>
      generateFrom({ "components/probe.tsx": "" }, {
        ...REGISTRY_ITEMS[0]!,
        registryDependencies: ["absent"],
      })
    ).toThrow(/does not ship/);
  });
});
