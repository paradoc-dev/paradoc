import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { resolveFontResource } from "../src/resources";

const require = createRequire(import.meta.url);
let dir: string;

describe("paradoc-react-pdf-002", () => {
  afterAll(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });
  it("reads a file URL whose path has a space", async () => {
    dir = await mkdtemp(join(tmpdir(), "rpdf-002-"));
    const spaced = join(dir, "My Fonts");
    await mkdir(spaced);
    const target = join(spaced, "inter.woff2");
    await copyFile(require.resolve("@fontsource-variable/inter/files/inter-latin-wght-normal.woff2"), target);
    const face = await resolveFontResource({ family: "Inter", source: pathToFileURL(target).href });
    expect(face.path).toBe(target);
    expect(face.data?.length).toBeGreaterThan(0);
  });
});
