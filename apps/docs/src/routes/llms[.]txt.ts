import { createFileRoute } from "@tanstack/react-router";
import { MCP_URL } from "@paradoc/agent-discovery";
import { pageMarkdownUrl } from "@/lib/page-actions";
import { source } from "@/lib/source";

const index = [
  "# Paradoc documentation",
  "",
  ...source.getPages().flatMap((page) => [
    `- [${page.data.title}](https://docs.paradoc.dev${pageMarkdownUrl(page.url)}): ${page.data.description ?? ""}`,
  ]),
  "",
  "## Agent resources",
  "",
  "- [Agent Skills index](https://docs.paradoc.dev/.well-known/agent-skills/index.json): the paradoc and paradoc-react skills, with digests",
  "- [API catalog](https://docs.paradoc.dev/.well-known/api-catalog): the hosted services",
  `- [MCP server card](https://docs.paradoc.dev/.well-known/mcp/server-card.json): how to connect to ${MCP_URL}`,
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
