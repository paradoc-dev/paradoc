import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { env } from "cloudflare:workers";

import {
  DOCS_ORIGIN,
  handleDiscoveryRequest,
  withHomepageLinks,
} from "@paradoc/agent-discovery";
import { getLLMText } from "@/lib/get-llm-text";
import { createDocsHandler } from "@/lib/docs-delivery";
import { redirectMovedPage } from "@/lib/moved-pages";
import { source } from "@/lib/source";

function notFound(request: Request): Response {
  return new Response(request.method === "HEAD" ? null : "Not found.\n", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      Vary: "Accept",
    },
  });
}

/**
 * Serve static assets first, then the app. The Worker runs ahead of the
 * assets so a page's Markdown form can answer at its ordinary URL. In dev
 * there is no assets binding and the app serves every request.
 */
async function serve(request: Request): Promise<Response> {
  if (env.ASSETS && new URL(request.url).pathname.startsWith("/.well-known/")) {
    // The namespace holds exact files. A path that is not one is absent: it
    // neither redirects to a trailing slash nor reaches the app.
    const asset = await env.ASSETS.fetch(request);
    return asset.status === 200 ? asset : notFound(request);
  }
  if (env.ASSETS && (request.method === "GET" || request.method === "HEAD")) {
    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404) return asset;
  }
  return handler.fetch(request);
}

const docs = createDocsHandler({
  findPage: (slugs) => source.getPage(slugs),
  markdownFor: getLLMText,
  serve,
});

export default createServerEntry({
  fetch: async (request) =>
    handleDiscoveryRequest(request, DOCS_ORIGIN) ??
    redirectMovedPage(request) ??
    withHomepageLinks(request, await docs(request), {
      href: "/llms.txt",
      type: "text/plain",
    }),
});
