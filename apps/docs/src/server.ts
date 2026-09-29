import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { env } from "cloudflare:workers";

import { getLLMText } from "@/lib/get-llm-text";
import { createDocsHandler } from "@/lib/docs-delivery";
import { source } from "@/lib/source";

/**
 * Serve static assets first, then the app. The Worker runs ahead of the
 * assets so a page's Markdown form can answer at its ordinary URL. In dev
 * there is no assets binding and the app serves every request.
 */
async function serve(request: Request): Promise<Response> {
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
  fetch: docs,
});
