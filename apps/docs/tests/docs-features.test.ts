import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { filterDocsFiles, PLATFORM_API_PAGE } from "@/lib/docs-features";

const CONTENT_DIR = path.resolve(__dirname, "../content/docs");

function contentPages(): string[] {
  return readdirSync(CONTENT_DIR, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => file.split(path.sep).join("/"));
}

/** Pages whose text links `slug`, as a docs URL. */
function pagesLinking(pages: Record<string, string>, slug: string): string[] {
  const link = new RegExp(
    `(?:\\]\\(|href=["'])/${slug}(?:[/#?]|["')])`,
  );
  return Object.entries(pages)
    .filter(([, text]) => link.test(text))
    .map(([file]) => file);
}

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

describe("gated platform API pages", () => {
  const gatedSlug = PLATFORM_API_PAGE.replace(/\.mdx$/, "");

  test("no page that is always built links a gated page", () => {
    const pages = Object.fromEntries(
      contentPages()
        .filter((file) => file !== PLATFORM_API_PAGE)
        .map((file) => [file, readFileSync(path.join(CONTENT_DIR, file), "utf8")]),
    );

    expect(pagesLinking(pages, gatedSlug)).toEqual([]);
  });

  test("finds a link to a gated page", () => {
    const pages = {
      "sdk/index.mdx": `See [Hosted sealing](/${gatedSlug}).`,
      "sdk/other.mdx": `See [Hosted sealing](/${gatedSlug}#adapter).`,
      "sdk/plain.mdx": "No link here.",
    };

    expect(pagesLinking(pages, gatedSlug)).toEqual(["sdk/index.mdx", "sdk/other.mdx"]);
  });
});
