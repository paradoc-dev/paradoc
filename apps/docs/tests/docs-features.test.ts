import { describe, expect, test } from "vitest";
import { filterDocsFiles } from "@/lib/docs-features";

const files = [
  {
    type: "page",
    path: "guides/sealing-and-conversion.mdx",
    data: { title: "Sealing" },
  },
  {
    type: "page",
    path: "guides/hosted-sealing-and-conversion.mdx",
    data: { title: "Hosted Sealing & Conversion" },
  },
  {
    type: "meta",
    path: "guides/meta.json",
    data: {
      pages: [
        "sealing-and-conversion",
        "hosted-sealing-and-conversion",
      ],
    },
  },
];

describe("docs feature flags", () => {
  test("excludes platform API pages and navigation when disabled", () => {
    const filtered = filterDocsFiles(files, false);

    expect(filtered.map((file) => file.path)).not.toContain(
      "guides/hosted-sealing-and-conversion.mdx",
    );
    expect(filtered.find((file) => file.type === "meta")?.data).toEqual({
      pages: ["sealing-and-conversion"],
    });
  });

  test("includes platform API pages and navigation when enabled", () => {
    expect(filterDocsFiles(files, true)).toEqual(files);
  });
});
