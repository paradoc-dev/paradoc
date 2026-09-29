import { createFileRoute } from "@tanstack/react-router";
import { pageMarkdownUrl } from "@/lib/page-actions";
import { source } from "@/lib/source";

const index = [
  "# Paradoc documentation",
  "",
  ...source.getPages().flatMap((page) => [
    `- [${page.data.title}](https://docs.paradoc.dev${pageMarkdownUrl(page.url)}): ${page.data.description ?? ""}`,
  ]),
].join("\n");

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(index, {
          headers: {
            "Cache-Control": "public, max-age=3600, s-maxage=86400",
            "Content-Type": "text/plain; charset=utf-8",
          },
        }),
    },
  },
});
