/**
 * The registry's one real claim, checked: an item installed by the stock shadcn
 * CLI compiles where it lands.
 *
 * A registry can be well formed and still ship files that do not build. The
 * usual way it happens is that the emitted content keeps the authoring import
 * paths — `../lib/format`, `@/registry/...` — which resolve in the repository
 * that generated them and nowhere else. Reading the JSON does not catch that;
 * only installing it does. So this suite serves the generated registry over a
 * loopback port, scaffolds a project in a temporary directory the way `npm
 * create vite` leaves one, runs the real CLI against it, and type-checks what
 * lands.
 *
 * The scratch project is outside the repository, and its dependencies are
 * symlinked from this package's own `node_modules` rather than installed from
 * the network. `@paradoc/react` resolves to this working tree, so the suite
 * measures the components as they are now, against the `dist` the turbo task
 * builds first.
 *
 * The one step that is stubbed is the package manager. An item declares its
 * substrate at a version (`@paradoc/react@^0.5.0`), and the CLI installs a
 * versioned dependency rather than skipping it even when the project already
 * has it, so leaving it real would make this suite depend on a public npm
 * registry to test something that is not npm's. A recording stub stands in, and
 * what it recorded is asserted: the CLI asked for the versions the items
 * declare.
 */

import { createServer, type Server } from "node:http";
import { execFile } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildRegistry, registryFileNames } from "../../scripts/build-registry";
import {
  ARTIFACT_DIR,
  INSTALL_DIR,
  REGISTRY_ITEMS,
  REGISTRY_NAMESPACE,
} from "../../scripts/registry/manifest";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Package managers the CLI might reach for, and the stub that answers. */
const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"] as const;

/** Packages the scratch project resolves from this package's own tree. */
const LINKED = [
  "react",
  "react-dom",
  "typescript",
  "@types/react",
  "@types/react-dom",
  "@paradoc/react",
  "@paradoc/core",
  "@paradoc/types",
] as const;

let workspace: string;
let project: string;
let stubBin: string;
let installLog: string;
let server: Server;
let origin: string;

/** Serves the emitted registry as the docs app does, at `/r/{name}.json`. */
function serveRegistry(directory: string): Promise<{ server: Server; origin: string }> {
  return new Promise((resolve) => {
    const created = createServer((request, response) => {
      const name = path.basename(new URL(request.url ?? "/", "http://localhost").pathname);
      const file = path.join(directory, name);
      if (!name.endsWith(".json") || !existsSync(file)) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, { "content-type": "application/json" });
      response.end(readFileSync(file));
    });
    created.listen(0, "127.0.0.1", () => {
      const address = created.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({ server: created, origin: `http://127.0.0.1:${port}` });
    });
  });
}

/** Resolves one of the scratch project's dependencies to a real directory on disk. */
function linkTarget(name: string): string {
  // The substrate is this working tree, so the suite measures the components as
  // they are now rather than a published version of them.
  if (name === "@paradoc/react") return packageRoot;
  return realpathSync(path.join(packageRoot, "node_modules", name));
}

/** Leaves a Vite-shaped TypeScript project ready for `shadcn add`. */
function scaffold(directory: string, registryOrigin: string): void {
  mkdirSync(path.join(directory, "src"), { recursive: true });

  // Every package the installed files import is already declared, which is what
  // makes the CLI's dependency step a no-op: it skips what package.json has.
  writeFileSync(
    path.join(directory, "package.json"),
    `${JSON.stringify(
      {
        name: "paradoc-registry-consumer",
        private: true,
        version: "0.0.0",
        type: "module",
        dependencies: {
          "@paradoc/core": "workspace:*",
          "@paradoc/react": "workspace:*",
          "@paradoc/types": "workspace:*",
          react: "^19",
          "react-dom": "^19",
        },
        devDependencies: {
          "@types/react": "^19",
          "@types/react-dom": "^19",
          typescript: "^5",
        },
      },
      null,
      2
    )}\n`
  );

  writeFileSync(
    path.join(directory, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          lib: ["ES2022", "DOM", "DOM.Iterable"],
          module: "ESNext",
          moduleResolution: "Bundler",
          jsx: "react-jsx",
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          isolatedModules: true,
          verbatimModuleSyntax: true,
          baseUrl: ".",
          paths: { "@/*": ["./src/*"] },
        },
        include: ["src"],
      },
      null,
      2
    )}\n`
  );

  writeFileSync(
    path.join(directory, "components.json"),
    `${JSON.stringify(
      {
        $schema: "https://ui.shadcn.com/schema.json",
        style: "new-york",
        rsc: false,
        tsx: true,
        tailwind: {
          config: "",
          css: "src/index.css",
          baseColor: "neutral",
          cssVariables: true,
        },
        aliases: {
          components: "@/components",
          utils: "@/lib/utils",
          ui: "@/components/ui",
          lib: "@/lib",
          hooks: "@/hooks",
        },
        registries: { [REGISTRY_NAMESPACE]: `${registryOrigin}/r/{name}.json` },
      },
      null,
      2
    )}\n`
  );

  writeFileSync(path.join(directory, "src/index.css"), '@import "tailwindcss";\n');

  const modules = path.join(directory, "node_modules");
  mkdirSync(path.join(modules, "@paradoc"), { recursive: true });
  mkdirSync(path.join(modules, "@types"), { recursive: true });
  for (const name of LINKED) {
    symlinkSync(linkTarget(name), path.join(modules, name), "dir");
  }
}

/**
 * Runs a Node program in the scratch project.
 *
 * Asynchronous, and that is load-bearing rather than stylistic: the registry is
 * served from this same process, so a synchronous child would hold the event
 * loop and the CLI would wait forever on a request nothing was left to answer.
 */
const run = promisify(execFile);

function node(script: string, args: string[]) {
  return run(process.execPath, [script, ...args], {
    cwd: project,
    encoding: "utf8",
    env: { ...process.env, PATH: `${stubBin}${path.delimiter}${process.env.PATH ?? ""}` },
  });
}

/** Runs the stock shadcn CLI the way a consumer does. */
function shadcn(args: string[]) {
  return node(path.join(packageRoot, "node_modules/shadcn/dist/index.js"), args);
}

/**
 * Puts a recording no-op in front of every package manager on PATH.
 *
 * It writes what it was asked to install and exits clean, so the CLI's install
 * step neither reaches the network nor hides what it wanted.
 */
function stubPackageManagers(directory: string, log: string): void {
  mkdirSync(directory, { recursive: true });
  for (const manager of PACKAGE_MANAGERS) {
    const bin = path.join(directory, manager);
    writeFileSync(bin, `#!/bin/sh\necho "${manager} $@" >> "${log}"\nexit 0\n`, {
      encoding: "utf8",
      mode: 0o755,
    });
  }
}

beforeAll(async () => {
  workspace = mkdtempSync(path.join(realpathSync(tmpdir()), "paradoc-registry-"));

  // The suite installs from a fresh build rather than the committed output, so
  // a component change is measured before it is committed, not after.
  const registryDir = path.join(workspace, "registry");
  mkdirSync(registryDir, { recursive: true });
  for (const [name, content] of registryFileNames(buildRegistry(packageRoot))) {
    writeFileSync(path.join(registryDir, name), content, "utf8");
  }

  const served = await serveRegistry(registryDir);
  server = served.server;
  origin = served.origin;

  project = path.join(workspace, "consumer");
  scaffold(project, origin);

  stubBin = path.join(workspace, "bin");
  installLog = path.join(workspace, "install.log");
  stubPackageManagers(stubBin, installLog);
}, 300_000);

afterAll(() => {
  server?.close();
  if (workspace) rmSync(workspace, { recursive: true, force: true });
});

describe("the registry installs into a fresh project", () => {
  it("writes every item where the manifest says", async () => {
    await shadcn([
      "add",
      ...REGISTRY_ITEMS.map((item) => `${REGISTRY_NAMESPACE}/${item.name}`),
      "--yes",
    ]);

    // The CLI puts a project's files under `src/` when it has one, target and
    // all, which is why a block's artifact lands beside the components rather
    // than at the repository root.
    const missing = REGISTRY_ITEMS.flatMap((item) => item.files)
      .map((file) => file.target)
      .filter((target) => !existsSync(path.join(project, "src", target)));
    expect(missing).toEqual([]);

    const installed = path.join(project, "src", INSTALL_DIR);
    expect(readdirSync(installed).sort()).toEqual(
      REGISTRY_ITEMS.map((item) => `${item.name}.tsx`).sort()
    );
  });

  it("installs a block's artifact under a name no item answers to", () => {
    // shadcn resolves an import by the item it appears to name, so an artifact
    // installed as `purchase-order.ts` would be reached at
    // `@/components/paradoc/purchase-order`, which is the composition. The
    // generator refuses that; this is the install it would have broken.
    const packet = readFileSync(
      path.join(project, "src", ARTIFACT_DIR, "vendor-packet.artifact.ts"),
      "utf8"
    );
    expect(packet).toContain(`from "@/${ARTIFACT_DIR}/purchase-order.artifact"`);
  });

  it("installs the annex as bytes, so the packet is self-contained", () => {
    const annex = readFileSync(
      path.join(project, "src", ARTIFACT_DIR, "vendor-packet.annex.ts"),
      "utf8"
    );
    expect(annex).toContain("export const vendorPacketAnnexBytes: Uint8Array");
    expect(annex).toContain('"JVBERi0');
  });

  it("keeps an aliased import aliased", () => {
    const packet = readFileSync(
      path.join(project, "src", INSTALL_DIR, "vendor-packet.tsx"),
      "utf8"
    );
    expect(packet).toContain("purchaseOrderData as defaultPurchaseOrderData");
  });

  it("type-checks what it installed", async () => {
    // Something has to use the components, or an unreferenced file could carry
    // a broken import and `include` alone would still pass.
    cpSync(
      path.join(packageRoot, "tests/registry/fixtures/consumer.tsx"),
      path.join(project, "src/consumer.tsx")
    );

    const check = await node(path.join(project, "node_modules/typescript/bin/tsc"), [
      "--noEmit",
    ]).catch((error: { stdout?: string; stderr?: string }) => ({
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
      failed: true as const,
    }));

    expect(`${check.stdout}${check.stderr}`.trim()).toBe("");
    expect("failed" in check).toBe(false);
  });

  it("asks the package manager for the substrate at the version the item declares", () => {
    const asked = existsSync(installLog) ? readFileSync(installLog, "utf8") : "";
    const version = JSON.parse(
      readFileSync(path.join(packageRoot, "package.json"), "utf8")
    ).version as string;

    expect(asked).toContain(`@paradoc/react@^${version}`);
    expect(asked).toContain(`@paradoc/core@^${version}`);
    // The packet block declares it without importing it: the W-9 is one of the
    // packet's parts, and nothing can fill or seal it without that artifact.
    expect(asked).toContain(`@paradoc/essentials@^${version}`);
  });

  it("keeps each component's own explanation in the installed file", () => {
    const field = readFileSync(
      path.join(project, "src", INSTALL_DIR, "field.tsx"),
      "utf8"
    );
    // The CLI drops everything above a file's first import, which is why the
    // generator moves the module comment below them.
    expect(field).toContain("A field is a pagination unit");
  });
});
