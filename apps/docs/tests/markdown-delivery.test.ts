import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";

import { canonicalMarkdownUrl } from "@/lib/canonical-url";
import { pageMarkdownUrl } from "@/lib/page-actions";
import {
  negotiateRepresentation,
  parseContentPath,
} from "@/lib/content-negotiation";
import { createDocsHandler } from "@/lib/docs-delivery";

describe("Accept negotiation", () => {
  test.each([
    [null, "html"],
    ["", "html"],
    ["*/*", "html"],
    ["text/*", "html"],
    ["text/html", "html"],
    ["text/markdown", "markdown"],
    ["text/markdown, text/html", "markdown"],
    ["text/html, text/markdown", "html"],
    ["text/html;q=0.9, text/markdown", "markdown"],
    ["text/markdown;q=0.5, text/html", "html"],
    ["text/markdown, */*;q=0.1", "markdown"],
    ["text/markdown;q=0, */*", "html"],
    ["text/markdown;q=0, text/html;q=0", null],
    ["text/html;q=0, */*", "markdown"],
    ["text/html;q=0, text/markdown", "markdown"],
    ["application/json", null],
    ["image/png, application/json;q=0.9", null],
  ])("Accept %j selects %j", (accept, expected) => {
    expect(negotiateRepresentation(accept)).toBe(expected);
  });
});

describe("content paths", () => {
  test.each([
    ["/", [], false],
    ["/concepts", ["concepts"], false],
    ["/concepts/", ["concepts"], false],
    ["/changelog/v0.6.0", ["changelog", "v0.6.0"], false],
    ["/concepts.md", ["concepts"], true],
    ["/concepts.md/", ["concepts"], true],
    ["/index.md", [], true],
    ["/guides/index.md", ["guides"], true],
    ["/changelog/v0.6.0.md", ["changelog", "v0.6.0"], true],
    ["/%63oncepts.md", ["concepts"], true],
    ["/.md", [".md"], false],
  ])("%s", (pathname, slugs, explicit) => {
    expect(parseContentPath(pathname)).toEqual({ slugs, explicit });
  });

  test("rejects malformed percent-encoding", () => {
    expect(parseContentPath("/%E0%A4%A.md")).toBeNull();
  });

  test("names the explicit Markdown URL on the docs host", () => {
    expect(canonicalMarkdownUrl("/concepts")).toBe(
      "https://docs.paradoc.dev/concepts.md",
    );
    expect(canonicalMarkdownUrl("/")).toBe("https://docs.paradoc.dev/index.md");
  });
});

describe("docs delivery", () => {
  const pages = new Map([
    ["", { url: "/" }],
    ["concepts", { url: "/concepts" }],
  ]);
  const served: Request[] = [];
  const handle = createDocsHandler({
    findPage: (slugs) => pages.get(slugs.join("/")),
    markdownFor: async (page) => `# ${page.url}`,
    serve: async (request) => {
      served.push(request);
      const { pathname } = new URL(request.url);
      return pathname === "/llms.txt" ||
        pathname === "/.well-known/agent-skills/paradoc/SKILL.md"
        ? new Response("index", { status: 200 })
        : pathname.startsWith("/concepts") || pathname === "/"
          ? new Response("<html>", {
              status: 200,
              headers: { "Content-Type": "text/html", Vary: "Origin" },
            })
          : new Response("<html>missing", { status: 404 });
    },
  });
  const get = (path: string, headers: Record<string, string> = {}, method = "GET") =>
    handle(new Request(`https://docs.paradoc.dev${path}`, { method, headers }));

  test("serves Markdown at an explicit URL, without JavaScript or Accept", async () => {
    const response = await get("/concepts.md");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
    expect(response.headers.get("Link")).toContain(
      '<https://docs.paradoc.dev/concepts/>; rel="canonical"',
    );
    expect(await response.text()).toBe("# /concepts\n");
  });

  test("serves Markdown at the ordinary URL when Accept asks for it", async () => {
    const response = await get("/concepts/", { Accept: "text/markdown" });
    expect(response.headers.get("Content-Type")).toContain("text/markdown");
    expect(response.headers.get("Vary")).toBe("Accept");
    expect(await response.text()).toBe("# /concepts\n");
    const root = await get("/", { Accept: "text/markdown" });
    expect(await root.text()).toBe("# /\n");
  });

  test("keeps HTML for default, wildcard and excluded Markdown requests", async () => {
    for (const accept of [undefined, "*/*", "text/html", "text/markdown;q=0, */*"]) {
      const response = await get("/concepts/", accept ? { Accept: accept } : {});
      expect(response.headers.get("Content-Type")).toBe("text/html");
      expect(response.headers.get("Vary")).toBe("Origin, Accept");
      expect(response.headers.get("Link")).toBe(
        '<https://docs.paradoc.dev/concepts.md>; rel="alternate"; type="text/markdown"',
      );
    }
  });

  test("answers each representation on its own, in either order", async () => {
    const markdown = { Accept: "text/markdown" };
    const kinds = [];
    for (const headers of [{}, markdown, markdown, {}]) {
      const response = await get("/concepts/", headers);
      kinds.push(response.headers.get("Content-Type")?.split(";")[0]);
    }
    expect(kinds).toEqual(["text/html", "text/markdown", "text/markdown", "text/html"]);
  });

  test("rejects an Accept that allows neither representation", async () => {
    const response = await get("/concepts/", { Accept: "application/json" });
    expect(response.status).toBe(406);
    expect(response.headers.get("Vary")).toBe("Accept");
  });

  test("answers a missing page with a real 404 in the requested format", async () => {
    const explicit = await get("/nope.md");
    expect(explicit.status).toBe(404);
    expect(explicit.headers.get("Content-Type")).toContain("text/markdown");

    const negotiated = await get("/nope", { Accept: "text/markdown" });
    expect(negotiated.status).toBe(404);
    expect(negotiated.headers.get("Content-Type")).toContain("text/markdown");

    const html = await get("/nope");
    expect(html.status).toBe(404);
    expect(html.headers.get("Vary")).toBe("Accept");
    expect(await html.text()).toBe("<html>missing");
  });

  test("treats a malformed path as absent", async () => {
    const response = await get("/%E0%A4%A", { Accept: "text/markdown" });
    expect(response.status).toBe(404);
  });

  test("gives an absent resource a 404 whatever the Accept header", async () => {
    served.length = 0;
    const json = await get("/.well-known/api-catalog", { Accept: "application/json" });
    expect(json.status).toBe(404);
    expect(json.headers.get("Content-Type")).toContain("text/plain");
    expect(served[0]?.headers.get("Accept")).toBe("text/html");
  });

  test("serves a Markdown file under /.well-known/ as an asset, not as a docs page", async () => {
    served.length = 0;
    for (const accept of [undefined, "text/markdown", "*/*"]) {
      const response = await get(
        "/.well-known/agent-skills/paradoc/SKILL.md",
        accept ? { Accept: accept } : {},
      );
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("index");
    }
    const missing = await get("/.well-known/agent-skills/paradoc/nope.md", {
      Accept: "text/markdown",
    });
    expect(missing.status).toBe(404);
  });

  test("passes existing resources and other methods to the app unchanged", async () => {
    served.length = 0;
    const index = await get("/llms.txt", { Accept: "text/markdown" });
    expect(index.status).toBe(200);
    await get("/_serverFn/abc", { Accept: "application/x-tsr-serialized" });
    await get("/concepts/", { Accept: "text/markdown" }, "POST");
    expect(served.map((request) => request.headers.get("Accept"))).toEqual([
      "text/html",
      "application/x-tsr-serialized",
      "text/markdown",
    ]);
  });

  test("agrees between GET and HEAD without sending a body", async () => {
    for (const [path, headers] of [
      ["/concepts.md", {}],
      ["/nope.md", {}],
      ["/concepts/", { Accept: "text/markdown" }],
      ["/concepts/", { Accept: "application/json" }],
    ] as const) {
      const full = await get(path, { ...headers });
      const head = await get(path, { ...headers }, "HEAD");
      expect(head.status).toBe(full.status);
      for (const name of ["Content-Type", "Vary", "Link", "Cache-Control"]) {
        expect(head.headers.get(name)).toBe(full.headers.get(name));
      }
      expect(await head.text()).toBe("");
    }
  });
});

const docsUrl = process.env.AUDIT_DOCS_URL;
describe.skipIf(!docsUrl)("built documentation delivery", () => {
  async function inventory(): Promise<string[]> {
    const sitemap = await (await fetch(new URL("/sitemap.xml", docsUrl))).text();
    return [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      ([, loc]) => new URL(loc!).pathname,
    );
  }

  /** Markdown outside code spans and fences that still looks like JSX. */
  function placeholders(markdown: string): string[] {
    return markdown
      .replace(/^```[\s\S]*?^```/gm, "")
      .replace(/`[^`]*`/g, "")
      .match(/<\/?[A-Z][A-Za-z]*[\s/>]/g) ?? [];
  }

  test("serves every published page as complete Markdown by both routes", async () => {
    const paths = await inventory();
    expect(paths.length).toBeGreaterThan(100);
    for (const pathname of paths) {
      const explicitPath = pageMarkdownUrl(pathname);
      const [explicit, negotiated] = await Promise.all([
        fetch(new URL(explicitPath, docsUrl)),
        fetch(new URL(pathname, docsUrl), { headers: { Accept: "text/markdown" } }),
      ]);
      const [explicitBody, negotiatedBody] = [await explicit.text(), await negotiated.text()];
      expect(explicit.status, explicitPath).toBe(200);
      expect(negotiated.status, pathname).toBe(200);
      expect(explicit.headers.get("content-type"), explicitPath).toContain("text/markdown");
      expect(negotiated.headers.get("content-type"), pathname).toContain("text/markdown");
      expect(negotiatedBody, pathname).toBe(explicitBody);
      expect(explicitBody, pathname).toContain(`Canonical URL: https://docs.paradoc.dev${pathname}`);
      expect(placeholders(explicitBody), pathname).toEqual([]);
      expect(explicitBody, pathname).not.toContain("__SCHEMA_VERSION__");
    }
  });

  test("keeps HTML for the same URLs and advertises the Markdown alternate", async () => {
    const response = await fetch(new URL("/concepts/", docsUrl), {
      headers: { Accept: "*/*" },
    });
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("vary")).toContain("Accept");
    // A local Worker rewrites the docs host in headers, so match the path.
    expect(response.headers.get("link")).toMatch(
      /^<https:\/\/[^>]+\/concepts\.md>; rel="alternate"; type="text\/markdown"$/,
    );
  });

  test("keeps unpublished pages hidden in every representation", async () => {
    for (const slug of ["guides/platform-access", "guides/hosted-sealing-and-conversion"]) {
      const responses = await Promise.all([
        fetch(new URL(`/${slug}.md`, docsUrl)),
        fetch(new URL(`/${slug}/`, docsUrl), { headers: { Accept: "text/markdown" } }),
        fetch(new URL(`/${slug}/`, docsUrl)),
      ]);
      expect(responses.map((response) => response.status), slug).toEqual([404, 404, 404]);
    }
  });

  test("serves discovery documents and complete skills, and 404s absent ones", async () => {
    const catalog = await fetch(new URL("/.well-known/api-catalog", docsUrl), {
      headers: { Accept: "application/linkset+json" },
    });
    expect(catalog.status).toBe(200);
    expect(catalog.headers.get("content-type")).toContain("application/linkset+json");
    const card = await fetch(new URL("/.well-known/mcp/server-card.json", docsUrl));
    expect(card.status).toBe(200);

    const index = (await (await fetch(new URL("/.well-known/agent-skills/index.json", docsUrl))).json()) as {
      skills: { name: string; url: string; digest: string }[];
    };
    expect(index.skills.map((skill) => skill.name)).toEqual(["paradoc", "paradoc-react"]);
    for (const skill of index.skills) {
      const archive = Buffer.from(await (await fetch(new URL(skill.url, docsUrl))).arrayBuffer());
      expect(`sha256:${createHash("sha256").update(archive).digest("hex")}`).toBe(skill.digest);
      const manifest = await fetch(new URL(`/.well-known/agent-skills/${skill.name}/SKILL.md`, docsUrl));
      expect(manifest.status).toBe(200);
    }

    for (const accept of ["text/html", "application/json", "application/linkset+json", "text/markdown", "*/*"]) {
      const absent = await fetch(new URL("/.well-known/ai-catalog.json", docsUrl), { headers: { Accept: accept } });
      expect(absent.status, accept).toBe(404);
    }
  });
});
