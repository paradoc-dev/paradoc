import { pageMarkdownUrl } from "@/lib/page-actions";

const DOCS_ORIGIN = "https://docs.paradoc.dev";

/** Return the single public URL form used for canonical metadata and discovery. */
export function canonicalDocsUrl(path: string): string {
  const url = new URL(path, DOCS_ORIGIN);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";

  url.pathname = pathname === "/" ? "/" : `${pathname}/`;
  url.search = "";
  url.hash = "";

  return url.toString();
}

/** The explicit Markdown URL of a docs page, on the public docs host. */
export function canonicalMarkdownUrl(path: string): string {
  return new URL(pageMarkdownUrl(new URL(path, DOCS_ORIGIN).pathname), DOCS_ORIGIN).toString();
}
