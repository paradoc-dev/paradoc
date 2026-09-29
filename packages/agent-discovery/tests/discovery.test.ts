import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import {
  API_CATALOG_PROFILE,
  DOCS_ORIGIN,
  LANDING_ORIGIN,
  MCP_URL,
  PLATFORM_API_URL,
  apiCatalog,
  handleDiscoveryRequest,
  homepageLinks,
  serverCard,
  withHomepageLinks,
} from "../src";

// The experimental Server Card v1 schema, copied from
// github.com/modelcontextprotocol/ext-server-card (schema.json).
const schema = JSON.parse(
  readFileSync(fileURLToPath(new URL("./fixtures/server-card.schema.json", import.meta.url)), "utf8"),
);

/** The schema file only holds definitions; validate against the Server Card one. */
function compileServerCard() {
  const ajv = new Ajv2020({ strict: false });
  addFormats(ajv);
  return ajv.compile({ ...schema, $ref: "#/$defs/ServerCard" });
}

const ask = (path: string, init: RequestInit = {}, origin = LANDING_ORIGIN) =>
  handleDiscoveryRequest(new Request(`${origin}${path}`, init), origin);

describe("server card", () => {
  it("validates against the Server Card v1 schema", () => {
    const validate = compileServerCard();
    expect(validate(serverCard()), JSON.stringify(validate.errors)).toBe(true);
  });

  it("is rejected by the schema when a required field is missing", () => {
    const validate = compileServerCard();
    const { version: _version, ...withoutVersion } = serverCard();
    expect(validate(withoutVersion)).toBe(false);
  });

  it("advertises only the hosted MCP endpoint and no secret value", () => {
    const card = serverCard();
    expect(card.remotes.map((remote) => remote.url)).toEqual([MCP_URL]);
    expect(JSON.stringify(card)).not.toMatch(/"value"/);
    expect(card.remotes[0]?.headers[0]).toMatchObject({ name: "x-api-key", isRequired: false, isSecret: true });
  });
});

describe("API catalog", () => {
  it("is an RFC 9264 linkset whose items are the real services", () => {
    const { linkset } = apiCatalog(LANDING_ORIGIN);
    const [catalog, ...described] = linkset;
    expect(catalog?.anchor).toBe(`${LANDING_ORIGIN}/.well-known/api-catalog`);
    expect(catalog?.item?.map((item) => item.href)).toEqual([PLATFORM_API_URL, MCP_URL]);
    expect(described.map((entry) => entry.anchor)).toEqual([PLATFORM_API_URL, MCP_URL]);
    for (const entry of linkset) {
      for (const [relation, targets] of Object.entries(entry)) {
        if (relation === "anchor") continue;
        for (const target of targets as { href: string }[]) expect(() => new URL(target.href)).not.toThrow();
      }
    }
  });

  it("points each host's MCP service description at its own server card", () => {
    const docs = apiCatalog(DOCS_ORIGIN).linkset.find((entry) => entry.anchor === MCP_URL);
    expect(docs?.["service-desc"]?.[0]?.href).toBe(`${DOCS_ORIGIN}/.well-known/mcp/server-card.json`);
  });
});

describe("handleDiscoveryRequest", () => {
  it("serves the catalog as a linkset with the RFC 9727 profile", async () => {
    const response = ask("/.well-known/api-catalog", { headers: { Accept: "application/linkset+json" } });
    expect(response?.status).toBe(200);
    expect(response?.headers.get("Content-Type")).toBe(`application/linkset+json; profile="${API_CATALOG_PROFILE}"`);
    expect(await response?.json()).toEqual(apiCatalog(LANDING_ORIGIN));
  });

  it("serves the server card as JSON", async () => {
    const response = ask("/.well-known/mcp/server-card.json", { headers: { Accept: "application/json" } });
    expect(response?.headers.get("Content-Type")).toBe("application/json");
    expect(await response?.json()).toEqual(serverCard());
  });

  it.each(["application/linkset+json", "application/json", "*/*", "application/*", "text/html,*/*;q=0.8", undefined])(
    "serves the catalog for Accept %s",
    (accept) => {
      const headers: Record<string, string> = accept ? { Accept: accept } : {};
      expect(ask("/.well-known/api-catalog", { headers })?.status).toBe(200);
    },
  );

  it.each(["text/html", "text/markdown", "application/xml", "*/*;q=0"])("refuses Accept %s with 406", (accept) => {
    const response = ask("/.well-known/api-catalog", { headers: { Accept: accept } });
    expect(response?.status).toBe(406);
    expect(response?.headers.get("Vary")).toBe("Accept");
  });

  it("makes HEAD agree with GET on status and metadata, without a body", async () => {
    const get = ask("/.well-known/api-catalog");
    const head = ask("/.well-known/api-catalog", { method: "HEAD" });
    expect(head?.status).toBe(get?.status);
    for (const name of ["Content-Type", "Content-Length", "Cache-Control", "Vary"]) {
      expect(head?.headers.get(name)).toBe(get?.headers.get(name));
    }
    expect(await head?.text()).toBe("");
  });

  it("refuses other methods with 405", () => {
    const response = ask("/.well-known/api-catalog", { method: "POST" });
    expect(response?.status).toBe(405);
    expect(response?.headers.get("Allow")).toBe("GET, HEAD");
  });

  it.each(["/.well-known/missing", "/.well-known/api-catalog/", "/.well-known/mcp.json", "/", "/blog"])(
    "leaves %s to the host",
    (path) => {
      expect(ask(path)).toBeNull();
    },
  );
});

describe("homepageLinks", () => {
  it("advertises the catalog, the skills index and the reading index", () => {
    expect(homepageLinks({ href: "/llms.txt", type: "text/plain" })).toEqual([
      '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
      '</.well-known/agent-skills/index.json>; rel="describedby"; type="application/json"; title="Agent Skills index"',
      '</llms.txt>; rel="describedby"; type="text/plain"; title="Reading index"',
    ]);
  });
});

describe("withHomepageLinks", () => {
  const at = (path: string) => new Request(`${LANDING_ORIGIN}${path}`);

  it("adds the links to a successful homepage response, keeping its own Link headers", () => {
    const original = new Response("<html>", { headers: { Link: '</index.md>; rel="alternate"' } });
    const response = withHomepageLinks(at("/"), original, { href: "/llms.txt", type: "text/plain" });
    expect(response.headers.get("Link")).toContain('</index.md>; rel="alternate"');
    expect(response.headers.get("Link")).toContain('rel="api-catalog"');
  });

  it("leaves other paths and failures alone", () => {
    expect(withHomepageLinks(at("/blog"), new Response("x"), { href: "/llms.txt", type: "text/plain" }).headers.get("Link")).toBeNull();
    expect(withHomepageLinks(at("/"), new Response("x", { status: 503 }), { href: "/llms.txt", type: "text/plain" }).headers.get("Link")).toBeNull();
  });
});
