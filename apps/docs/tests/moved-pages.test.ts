/**
 * Moved pages answer their old URLs with a permanent redirect to a page that
 * exists. The page list comes from the real content folder.
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { MOVED_PAGES, movedPath, redirectMovedPage } from "@/lib/moved-pages";

const contentDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../content/docs",
);

/** Every page URL, from the file paths: groups like `(reference)` add no segment. */
function pageUrls(dir = ""): string[] {
  const urls: string[] = [];
  for (const entry of readdirSync(path.join(contentDir, dir), {
    withFileTypes: true,
  })) {
    const relative = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) urls.push(...pageUrls(relative));
    else if (entry.name.endsWith(".mdx")) {
      const segments = relative
        .replace(/\.mdx$/, "")
        .split("/")
        .filter((segment) => !/^\(.+\)$/.test(segment));
      if (segments.at(-1) === "index") segments.pop();
      urls.push(`/${segments.join("/")}`);
    }
  }
  return urls;
}

const pages = new Set(pageUrls());

describe("moved pages", () => {
  test.each(MOVED_PAGES)("%s now lives at %s, and nothing is left behind", (from, to) => {
    expect(pages.has(to)).toBe(true);
    expect(pages.has(from)).toBe(false);
    expect([...pages].some((url) => url.startsWith(`${from}/`))).toBe(false);
  });

  test.each([
    ["/skill", "/ai/skills"],
    ["/skill/paradoc-react", "/ai/skills/paradoc-react"],
    ["/ai/tools", "/ai-tools"],
    ["/ai/tools/fill", "/ai-tools/fill"],
    ["/ai/tools/fill.md", "/ai-tools/fill.md"],
    ["/skill.md", "/ai/skills.md"],
    ["/ai/ai-tools", "/ai/other-frameworks"],
    ["/cli/registries", "/concepts/registries"],
  ])("%s redirects to %s, a real page", (from, to) => {
    expect(movedPath(from)).toBe(to);
    expect(pages.has(to.replace(/\.md$/, ""))).toBe(true);
  });

  test.each(["/", "/ai", "/ai-tools", "/skills", "/ai/toolsets", "/cli/commands", "/skillful"])(
    "%s stays where it is",
    (pathname) => {
      expect(movedPath(pathname)).toBeUndefined();
    },
  );

  test("a GET answers with a permanent redirect that keeps the query", () => {
    const response = redirectMovedPage(
      new Request("https://docs.paradoc.dev/ai/tools/render?ref=x"),
    );
    expect(response?.status).toBe(301);
    expect(response?.headers.get("Location")).toBe("/ai-tools/render?ref=x");
  });

  test("other methods and unmoved pages pass through", () => {
    expect(
      redirectMovedPage(new Request("https://docs.paradoc.dev/skill", { method: "POST" })),
    ).toBeUndefined();
    expect(redirectMovedPage(new Request("https://docs.paradoc.dev/sdk"))).toBeUndefined();
  });
});
