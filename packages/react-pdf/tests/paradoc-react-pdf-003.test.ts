import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { FontResourceError, resolveFontResource } from "../src/resources";

const require = createRequire(import.meta.url);
let app: string;

describe("paradoc-react-pdf-003", () => {
  afterAll(async () => { if (app) await rm(app, { recursive: true, force: true }); });
  it("resolves a package specifier from the caller", async () => {
    app = await mkdtemp(join(tmpdir(), "rpdf-003-app-"));
    const pkg = join(app, "node_modules", "@acme-validation", "fonts");
    await mkdir(join(pkg, "files"), { recursive: true });
    await writeFile(join(pkg, "package.json"), JSON.stringify({ name: "@acme-validation/fonts", version: "1.0.0" }));
    await copyFile(require.resolve("@fontsource-variable/inter/files/inter-latin-wght-normal.woff2"), join(pkg, "files", "a.woff2"));
    const face = await resolveFontResource(
      { family: "Acme", source: "@acme-validation/fonts/files/a.woff2" },
      { resolveFrom: app }
    );
    expect(face.data?.length).toBeGreaterThan(0);
  });
  it("reports a failed package resolution without reading the specifier as a path", async () => {
    await expect(resolveFontResource(
      { family: "Missing", source: "@acme-validation/missing/font.woff2" },
      { resolveFrom: app }
    )).rejects.toBeInstanceOf(FontResourceError);
  });
});
