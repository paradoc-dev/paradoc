import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { discoverCompositions, UNPAIRED_MESSAGE } from "../src/discovery";

let root: string;

async function write(relativePath: string, content: string): Promise<void> {
  const file = resolve(root, relativePath);
  await fs.mkdir(dirname(file), { recursive: true });
  await fs.writeFile(file, content, "utf8");
}

beforeEach(async () => {
  root = await fs.realpath(await fs.mkdtemp(join(tmpdir(), "paradoc-react-011-")));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("paradoc-react-011", () => {
  it("reports a sibling artifact with invalid YAML as broken", async () => {
    await write("compositions/purchase-order.tsx", "export default () => null");
    await write("compositions/purchase-order.yaml", "kind: form\nname: purchase-order\nfields:\n  a: [unclosed\n");
    const [entry] = await discoverCompositions(root);
    expect(entry?.problems).not.toContain(UNPAIRED_MESSAGE);
    expect(entry?.problems.join("\n")).toMatch(/purchase-order\.yaml/);
  });
});
