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
