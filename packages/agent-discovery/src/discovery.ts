import {
  API_CATALOG_PATH,
  MCP_RESOURCE_METADATA_URL,
  MCP_SERVER_VERSION,
  MCP_STATUS_URL,
  MCP_URL,
  PLATFORM_API_STATUS_URL,
  PLATFORM_API_URL,
  SERVER_CARD_PATH,
  SKILLS_INDEX_PATH,
} from "./services";

/** The RFC 9727 profile URI of an API catalog. */
export const API_CATALOG_PROFILE = "https://www.rfc-editor.org/info/rfc9727";
export const LINKSET_MEDIA_TYPE = "application/linkset+json";
/** The Server Card schema this document conforms to (experimental, v1). */
export const SERVER_CARD_SCHEMA =
  "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json";

const CACHE_CONTROL = "public, max-age=3600";

interface LinkTarget {
  href: string;
  type?: string;
  title?: string;
}

/** RFC 9727 API catalog, as an RFC 9264 linkset. */
export function apiCatalog(origin: string) {
  const link = (target: LinkTarget) => [target];
  return {
    linkset: [
      {
        anchor: `${origin}${API_CATALOG_PATH}`,
        item: [{ href: PLATFORM_API_URL }, { href: MCP_URL }],
      },
      {
        anchor: PLATFORM_API_URL,
        status: link({ href: PLATFORM_API_STATUS_URL, type: "application/json" }),
      },
      {
        anchor: MCP_URL,
        "service-desc": link({
          href: `${origin}${SERVER_CARD_PATH}`,
          type: "application/json",
          title: "MCP Server Card",
        }),
        status: link({ href: MCP_STATUS_URL, type: "application/json" }),
        describedby: link({
          href: MCP_RESOURCE_METADATA_URL,
          type: "application/json",
          title: "OAuth protected-resource metadata",
        }),
      },
    ],
  };
}

/**
 * The MCP Server Card of the hosted server. It describes connectivity only;
 * tools are listed at runtime through the protocol. Publishing it grants no
 * access: the endpoint still requires OAuth or an API key.
 */
export function serverCard() {
  return {
    $schema: SERVER_CARD_SCHEMA,
    name: "dev.paradoc/mcp",
    title: "Paradoc",
    version: MCP_SERVER_VERSION,
    description: "Fill, render, seal and send Paradoc forms and documents.",
    websiteUrl: "https://paradoc.dev",
    repository: {
      url: "https://github.com/paradoc-dev/paradoc",
      source: "github",
    },
    remotes: [
      {
        type: "streamable-http",
        url: MCP_URL,
        headers: [
          {
            name: "x-api-key",
            description:
              "A Paradoc API key, for clients that cannot run OAuth. Interactive clients sign in with OAuth instead.",
            isRequired: false,
            isSecret: true,
          },
        ],
      },
    ],
  };
}

/** A host's reading index: the document an agent reads to find its pages. */
export interface ReadingIndex {
  href: string;
  type: string;
}

/**
 * Link header values for a host's homepage: the API catalog, the agent skills
 * index and the reading index.
 */
export function homepageLinks(readingIndex: ReadingIndex): string[] {
  return [
    `<${API_CATALOG_PATH}>; rel="api-catalog"; type="${LINKSET_MEDIA_TYPE}"`,
    `<${SKILLS_INDEX_PATH}>; rel="describedby"; type="application/json"; title="Agent Skills index"`,
    `<${readingIndex.href}>; rel="describedby"; type="${readingIndex.type}"; title="Reading index"`,
  ];
}

/** Add the homepage Link headers to a successful response for `/`. Other responses pass through. */
export function withHomepageLinks(request: Request, response: Response, readingIndex: ReadingIndex): Response {
  if (new URL(request.url).pathname !== "/" || response.status !== 200) return response;
  const next = new Response(response.body, response);
  for (const link of homepageLinks(readingIndex)) next.headers.append("Link", link);
  return next;
}

interface Range {
  type: string;
  subtype: string;
  q: number;
}

function parseAccept(header: string): Range[] {
  const ranges: Range[] = [];
  for (const part of header.split(",")) {
    const [media = "", ...params] = part.trim().split(";");
    const [type, subtype] = media.trim().toLowerCase().split("/");
    if (!type || !subtype) continue;
    let q = 1;
    for (const param of params) {
      const [key, value] = param.split("=").map((piece) => piece.trim());
      if (key?.toLowerCase() === "q") {
        const parsed = Number(value);
        q = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1) : 0;
      }
    }
    ranges.push({ type, subtype, q });
  }
  return ranges;
}

/** Whether `Accept` admits any of the media types, by RFC 9110 most-specific match. */
function accepts(header: string | null, mediaTypes: string[]): boolean {
  if (!header?.trim()) return true;
  const ranges = parseAccept(header);
  return mediaTypes.some((mediaType) => {
    const [type, subtype] = mediaType.split("/");
    let best: { rank: number; q: number } | undefined;
    for (const range of ranges) {
      const rank =
        range.type === type && range.subtype === subtype
          ? 3
          : range.type === type && range.subtype === "*"
            ? 2
            : range.type === "*" && range.subtype === "*"
              ? 1
              : 0;
      if (rank > 0 && (!best || rank > best.rank)) best = { rank, q: range.q };
    }
    return best !== undefined && best.q > 0;
  });
}

interface Document {
  contentType: string;
  /** Media types an `Accept` header may name to receive this document. */
  accepted: string[];
  body: unknown;
}

function documents(origin: string): Record<string, Document> {
  return {
    [API_CATALOG_PATH]: {
      contentType: `${LINKSET_MEDIA_TYPE}; profile="${API_CATALOG_PROFILE}"`,
      accepted: [LINKSET_MEDIA_TYPE, "application/json"],
      body: apiCatalog(origin),
    },
    [SERVER_CARD_PATH]: {
      contentType: "application/json",
      accepted: ["application/json"],
      body: serverCard(),
    },
  };
}

function plain(status: number, body: string, headers: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

/**
 * Answer a request for a discovery document, or return null when the path is
 * not one. The documents are the same for GET and HEAD, and public: they carry
 * no credentials and grant no service access.
 */
export function handleDiscoveryRequest(request: Request, origin: string): Response | null {
  const { pathname } = new URL(request.url);
  const document = documents(origin)[pathname];
  if (!document) return null;

  if (request.method !== "GET" && request.method !== "HEAD") {
    return plain(405, "Method Not Allowed\n", { Allow: "GET, HEAD" });
  }
  if (!accepts(request.headers.get("Accept"), document.accepted)) {
    return plain(406, `Not Acceptable. This resource is ${document.accepted.join(" or ")}.\n`, {
      Vary: "Accept",
    });
  }

  const body = `${JSON.stringify(document.body, null, 2)}\n`;
  return new Response(request.method === "HEAD" ? null : body, {
    headers: {
      "Content-Type": document.contentType,
      "Content-Length": String(new TextEncoder().encode(body).byteLength),
      "Cache-Control": CACHE_CONTROL,
      "Access-Control-Allow-Origin": "*",
      Vary: "Accept",
    },
  });
}
