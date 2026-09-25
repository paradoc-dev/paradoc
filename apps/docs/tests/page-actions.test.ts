import { describe, expect, test } from "vitest";
import { pageGitHubUrl, pageMarkdownUrl } from "@/lib/page-actions";
import { expandComponentMarkdown } from "@/lib/page-markdown";

describe("page actions", () => {
  test("points page Markdown actions at the built Markdown route", () => {
    expect(pageMarkdownUrl("/concepts")).toBe("/llms.mdx/docs/concepts");
    expect(pageMarkdownUrl("/")).toBe("/llms.mdx/docs");
  });

  test("points source links at the public repository", () => {
    expect(pageGitHubUrl("concepts/index.mdx")).toBe(
      "https://github.com/paradoc-dev/paradoc/blob/main/apps/docs/content/docs/concepts/index.mdx",
    );
    expect(pageGitHubUrl("changelog/index.mdx")).toBe(
      "https://github.com/paradoc-dev/paradoc/blob/main/CHANGELOG.md",
    );
  });

  test("expands component documentation from built registry content", () => {
    const markdown = expandComponentMarkdown(
      '<ComponentInstallation name="text" />',
    );
    expect(markdown).toContain("npx shadcn@4 add @paradoc/text");
    expect(markdown).not.toContain("ComponentInstallation");
  });
});

const docsUrl = process.env.AUDIT_DOCS_URL;
describe.skipIf(!docsUrl)("built documentation routes", () => {
  test.each(["concepts", "quickstart"])(
    "serves processed Markdown for %s",
    async (slug) => {
      const response = await fetch(
        new URL(pageMarkdownUrl(`/${slug}`), docsUrl),
      );
      const body = await response.text();
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/markdown");
      expect(body).not.toContain("__SCHEMA_VERSION__");
    },
  );

  test("serves the index and component-expanded full text", async () => {
    const [index, full] = await Promise.all([
      fetch(new URL("/llms.txt", docsUrl)),
      fetch(new URL("/llms-full.txt", docsUrl)),
    ]);
    expect(index.status).toBe(200);
    expect(await index.text()).toContain("https://docs.paradoc.dev/concepts.mdx");
    expect(full.status).toBe(200);
    const fullText = await full.text();
    expect(fullText).toContain("npx shadcn@4 add @paradoc/text");
    expect(fullText).not.toContain("<ComponentInstallation");
  });

  test("links a missing page back to the home page", async () => {
    const response = await fetch(new URL("/missing-page", docsUrl));
    expect(response.status).toBe(404);
    expect(await response.text()).toContain('href="/"');
  });
});
