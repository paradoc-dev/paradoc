import { createFileRoute } from "@tanstack/react-router";
import { ImageResponse } from "workers-og";
import { source } from "@/lib/source";

const BACKGROUND_URL = "https://assets.paradoc.dev/paradoc-og-docs-background.png";
// Finished static card, used as the fallback if generation ever fails, so the
// OG image is never a blank 200.
const FALLBACK_OG_URL = "https://assets.paradoc.dev/paradoc-og-docs.png";
// Fetched cross-origin from the assets bucket. It must NOT come from
// docs.paradoc.dev: fetching this Worker's own domain is a self-request that
// returns the app's HTML instead of the font, which crashes the renderer
// (Satori: "Unsupported OpenType signature") and yields a blank image.
const GEIST_FONT_URL =
  "https://assets.paradoc.dev/fonts/geist-sans-latin-600-normal.woff";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const Route = createFileRoute("/api/og/docs/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const slugs = params._splat?.split("/") ?? [];

          // Remove the trailing "image.png" from slugs
          const pageSlug = slugs.slice(0, -1);
          const page = source.getPage(pageSlug);

          const pageData = page?.data as Record<string, unknown> | undefined;
          const title =
            (pageData?.ogTitle as string) ??
            (pageData?.title as string) ??
            "Paradoc Documentation";
          const description =
            (pageData?.ogDescription as string) ??
            (pageData?.description as string) ??
            "Documents as code for developers and AI agents";

          const fontData = await (await fetch(GEIST_FONT_URL)).arrayBuffer();

          const html = `
            <div style="display: flex; flex-direction: column; width: 1200px; height: 630px; background-color: #0a0a0a; color: white; padding: 64px; font-family: 'Geist Sans', system-ui, sans-serif; position: relative;">
              <img src="${BACKGROUND_URL}" width="1200" height="630" style="position: absolute; top: 0; left: 0; object-fit: cover;" />
              <div style="display: flex; flex-direction: column; width: 100%; height: 100%; position: relative;">
                <div style="display: flex; flex-direction: column; gap: 16px; margin-top: auto; margin-bottom: auto;">
                  <h1 style="font-size: 52px; font-weight: 600; letter-spacing: -0.02em; margin: 0;">${escapeHtml(title)}</h1>
                  ${description ? `<p style="font-size: 26px; color: #d6d3d1; margin: 0; max-width: 900px; font-weight: 400; line-height: 1.4; text-wrap: balance;">${escapeHtml(description)}</p>` : ""}
                </div>
                <div style="display: flex; align-items: center;">
                  <span style="font-size: 18px; color: #d6d3d1;">docs.paradoc.dev</span>
                </div>
              </div>
            </div>
          `;

          const image = new ImageResponse(html, {
            width: 1200,
            height: 630,
            format: "png",
            fonts: [
              {
                name: "Geist Sans",
                data: fontData,
                weight: 600,
                style: "normal",
              },
            ],
          });

          // Force the render so a silent failure can't slip through as a blank
          // 200 — fall back to the static card instead.
          const bytes = await image.arrayBuffer();
          if (bytes.byteLength === 0) {
            return Response.redirect(FALLBACK_OG_URL, 302);
          }

          return new Response(bytes, {
            headers: {
              "Content-Type": "image/png",
              // Cache for 1 week at edge, 1 day in browser
              "Cache-Control": "public, s-maxage=604800, max-age=86400",
            },
          });
        } catch {
          return Response.redirect(FALLBACK_OG_URL, 302);
        }
      },
    },
  },
});
