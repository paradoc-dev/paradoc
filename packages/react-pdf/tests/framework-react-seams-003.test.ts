import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { discoverCompositions } from "@paradoc/react/discovery";
import { bindComponent } from "../src/layer";

let root: string;
let composition: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "seams-003-"));
  await mkdir(join(root, "artifacts"));
  await mkdir(join(root, "compositions"));
  composition = join(root, "compositions", "po.tsx");
  await writeFile(composition, "export default function Po() { return null; }\n");
  await writeFile(join(root, "artifacts", "po.yaml"), ["kind: form", "name: po", "fields: {}", "layers:", "  react:", "    kind: file", "    mimeType: text/tsx", "    path: ../compositions/po.tsx", ""].join("\n"));
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("framework-react-seams-003", () => {
  it("discovery and binding both reject a layer path that leaves the artifact directory", async () => {
    const [entry] = await discoverCompositions(root);
    expect(entry?.problems.join("\n")).toMatch(/leaves the artifact directory/);
    const artifactDir = dirname(join(root, "artifacts", "po.yaml"));
    await expect(bindComponent(
      { type: "react", mimeType: "text/tsx", key: "react", path: relative(artifactDir, composition) } as never,
      { baseDir: artifactDir }
    )).rejects.toThrow(/outside/);
  });
});
