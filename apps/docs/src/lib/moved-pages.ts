/**
 * Pages that moved to a new URL. Each entry maps an old path to its new one,
 * and covers the pages under it: `/ai/tools/fill` moves with `/ai/tools`.
 * Links already published keep working through a permanent redirect.
 */
export const MOVED_PAGES: ReadonlyArray<readonly [from: string, to: string]> = [
  ["/ai/ai-tools", "/ai/other-frameworks"],
  ["/ai/tools", "/ai-tools"],
  ["/skill", "/ai/skills"],
  ["/cli/registries", "/concepts/registries"],
];

const MARKDOWN_SUFFIX = ".md";

/**
 * The new path of a moved page, or undefined when `pathname` did not move.
 * An explicit Markdown URL (`/skill.md`) moves to the new page's Markdown URL.
 */
export function movedPath(pathname: string): string | undefined {
  const markdown = pathname.endsWith(MARKDOWN_SUFFIX);
  const path = markdown ? pathname.slice(0, -MARKDOWN_SUFFIX.length) : pathname;

  for (const [from, to] of MOVED_PAGES) {
    if (path === from || path.startsWith(`${from}/`)) {
      const moved = to + path.slice(from.length);
      return markdown ? moved + MARKDOWN_SUFFIX : moved;
    }
  }
  return undefined;
}

/** A permanent redirect for a GET or HEAD of a moved page, keeping the query. */
export function redirectMovedPage(request: Request): Response | undefined {
  if (request.method !== "GET" && request.method !== "HEAD") return undefined;
  const url = new URL(request.url);
  const moved = movedPath(url.pathname);
  if (!moved) return undefined;
  return new Response(null, {
    status: 301,
    headers: {
      Location: moved + url.search,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
