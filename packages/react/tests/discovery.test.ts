/**
 * The conventions that connect a composition to its artifact and its sample.
 *
 * They are tested here, in the package that owns them, because two commands
 * read them — `para dev` builds a preview from every answer, `para check`
 * checks one — and a rule proved in one command's tests would be a rule the
 * other could quietly disagree with.
 */

import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  describeComposition,
  discoverCompositions,
  findCompositionArtifact,
  sampleSources,
  siblingArtifact,
} from "../src/discovery";

let root: string;

/** A form artifact declaring one React layer at `path`. */
function artifact(name: string, path: string): string {
  return JSON.stringify({
    $schema: "https://schema.paradoc.dev/schema.json",
    kind: "form",
    name,
    version: "1.0.0",
    title: name,
    fields: { customerName: { type: "text", label: "Customer" } },
    defaultLayer: "composition",
    layers: {
      composition: { kind: "file", mimeType: "text/tsx", path, title: "Composition" },
    },
  });
}

async function write(relativePath: string, content: string): Promise<void> {
  const file = resolve(root, relativePath);
  await fs.mkdir(dirname(file), { recursive: true });
  await fs.writeFile(file, content, "utf8");
}

beforeEach(async () => {
  root = await fs.realpath(await fs.mkdtemp(join(tmpdir(), "paradoc-discovery-")));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("finding compositions", () => {
  it("finds every tsx and jsx file under a compositions directory", async () => {
    await write("compositions/purchase-order.tsx", "export default () => null");
    await write("src/compositions/nested/change-order.jsx", "export default () => null");
    await write("src/not-a-composition.tsx", "export default () => null");

    const found = await discoverCompositions(root);

    expect(found.map((entry) => entry.relative)).toEqual([
      "compositions/purchase-order.tsx",
      "src/compositions/nested/change-order.jsx",
    ]);
    expect(found.map((entry) => entry.id)).toEqual([
      "compositions/purchase-order",
      "src/compositions/nested/change-order",
    ]);
  });

  it("skips the sample and test modules that live beside a composition", async () => {
    await write("compositions/purchase-order.tsx", "export default () => null");
    await write("compositions/purchase-order.sample.tsx", "export default {}");
    await write("compositions/purchase-order.test.tsx", "export default {}");
    await write("compositions/purchase-order.stories.tsx", "export default {}");

    const found = await discoverCompositions(root);

    expect(found.map((entry) => entry.relative)).toEqual(["compositions/purchase-order.tsx"]);
  });

  it("never walks into node_modules or a build directory", async () => {
    await write("node_modules/pkg/compositions/vendor.tsx", "export default () => null");
    await write("dist/compositions/built.tsx", "export default () => null");
    await write("compositions/mine.tsx", "export default () => null");

    const found = await discoverCompositions(root);

    expect(found.map((entry) => entry.relative)).toEqual(["compositions/mine.tsx"]);
  });
});

describe("pairing a composition with its artifact", () => {
  it("pairs through the React layer, resolved against the artifact file", async () => {
    await write("compositions/purchase-order.tsx", "export default () => null");
    await write(
      "artifacts/purchase-order.json",
      artifact("purchase-order", "../compositions/purchase-order.tsx")
    );

    const [entry] = await discoverCompositions(root);

    expect(entry?.artifact?.relative).toBe("artifacts/purchase-order.json");
    expect(entry?.artifact?.layer).toBe("composition");
    expect(entry?.artifact?.mimeType).toBe("text/tsx");
    expect(entry?.artifact?.matchedBy).toBe("layer");
    expect(entry?.problems).toEqual([]);
  });

  it("falls back to a sibling artifact of the same name", async () => {
    await write("compositions/change-order.tsx", "export default () => null");
    await write("compositions/change-order.json", artifact("change-order", "somewhere-else.tsx"));

    const [entry] = await discoverCompositions(root);

    expect(entry?.artifact?.relative).toBe("compositions/change-order.json");
    expect(entry?.artifact?.matchedBy).toBe("sibling");
    expect(entry?.artifact?.layer).toBeUndefined();
    expect(entry?.problems).toEqual([]);
  });

  it("offers the same sibling to a caller asking about one composition", async () => {
    await write("compositions/change-order.tsx", "export default () => null");
    await write("compositions/change-order.yaml", artifact("change-order", "elsewhere.tsx"));

    const file = resolve(root, "compositions/change-order.tsx");
    expect((await findCompositionArtifact(root, file)).byLayer).toEqual([]);
    expect((await siblingArtifact(root, file))?.name).toBe("change-order");
  });

  it("prefers the layer pointer over a sibling of the same name", async () => {
    await write("compositions/purchase-order.tsx", "export default () => null");
    await write("compositions/purchase-order.json", artifact("sibling-one", "nothing.tsx"));
    await write("purchase-order.yaml", artifact("pointed-at", "compositions/purchase-order.tsx"));

    const [entry] = await discoverCompositions(root);

    expect(entry?.artifact?.name).toBe("pointed-at");
    expect(entry?.artifact?.matchedBy).toBe("layer");
  });

  it("reports a composition no artifact points at, naming both rules", async () => {
    await write("compositions/orphan.tsx", "export default () => null");

    const [entry] = await discoverCompositions(root);

    expect(entry?.artifact).toBeUndefined();
    expect(entry?.problems).toHaveLength(1);
    expect(entry?.problems[0]).toContain("text/tsx");
    expect(entry?.problems[0]).toContain("same name beside it");
  });

  it("reports an ambiguous pairing rather than choosing in silence", async () => {
    await write("compositions/shared.tsx", "export default () => null");
    await write("one.json", artifact("one", "compositions/shared.tsx"));
    await write("two.json", artifact("two", "compositions/shared.tsx"));

    const [entry] = await discoverCompositions(root);
    const match = await findCompositionArtifact(root, resolve(root, "compositions/shared.tsx"));

    expect(match.byLayer).toHaveLength(2);
    expect(entry?.problems[0]).toContain("2 artifacts declare a React layer");
  });

  it("ignores JSON and YAML that is not a form artifact", async () => {
    await write("compositions/purchase-order.tsx", "export default () => null");
    await write("package.json", JSON.stringify({ name: "scratch", kind: "form" }));
    await write("data/values.json", JSON.stringify({ anything: true }));
    await write("broken.yaml", "this: [is not\n  valid");
    await write("guide.yaml", JSON.stringify({ kind: "document", name: "guide", version: "1.0.0" }));
    await write("purchase-order.yaml", artifact("paired", "compositions/purchase-order.tsx"));

    const [entry] = await discoverCompositions(root);

    expect(entry?.artifact?.name).toBe("paired");
  });

  it("reports an artifact that does not validate, rather than crashing", async () => {
    await write("compositions/broken.tsx", "export default () => null");
    await write(
      "broken.json",
      JSON.stringify({
        kind: "form",
        name: "broken",
        version: "1.0.0",
        title: "Broken",
        fields: { customerName: { type: "not-a-type" } },
        layers: {
          composition: { kind: "file", mimeType: "text/tsx", path: "compositions/broken.tsx" },
        },
      })
    );

    const [entry] = await discoverCompositions(root);

    expect(entry?.artifact?.name).toBe("broken");
    expect(entry?.problems.join(" ")).toContain("is not valid");
  });
});

describe("finding sample data", () => {
  it("puts a sibling sample module ahead of the composition's own export", async () => {
    await write("compositions/purchase-order.tsx", "export const sample = { fields: {} }");
    await write("compositions/purchase-order.sample.ts", "export default { fields: {} }");

    const sources = await sampleSources(root, resolve(root, "compositions/purchase-order.tsx"));

    expect(sources.map((source) => [source.relative, source.exportName, source.from])).toEqual([
      ["compositions/purchase-order.sample.ts", "default", "sibling"],
      ["compositions/purchase-order.tsx", "sample", "composition"],
    ]);
  });

  it("offers every sibling extension, in order, then the composition", async () => {
    await write("compositions/a.tsx", "export default () => null");
    await write("compositions/a.sample.js", "export default { fields: {} }");
    await write("compositions/a.sample.tsx", "export default { fields: {} }");

    const sources = await sampleSources(root, resolve(root, "compositions/a.tsx"));

    expect(sources.map((source) => source.relative)).toEqual([
      "compositions/a.sample.tsx",
      "compositions/a.sample.js",
      "compositions/a.tsx",
    ]);
  });

  it("falls back to the composition module when no sibling exists", async () => {
    await write("compositions/purchase-order.tsx", "export const sample = { fields: {} }");

    const [entry] = await discoverCompositions(root);

    expect(entry?.samples).toHaveLength(1);
    expect(entry?.samples[0]?.from).toBe("composition");
    expect(entry?.samples[0]?.exportName).toBe("sample");
  });
});

describe("describing what was found", () => {
  it("names the composition, its artifact and its sample in one line", async () => {
    await write("compositions/purchase-order.tsx", "export default () => null");
    await write("compositions/purchase-order.sample.ts", "export default { fields: {} }");
    await write("purchase-order.yaml", artifact("paired", "compositions/purchase-order.tsx"));

    const [entry] = await discoverCompositions(root);

    expect(describeComposition(entry!)).toBe(
      "compositions/purchase-order.tsx → purchase-order.yaml#composition · compositions/purchase-order.sample.ts"
    );
  });
});
