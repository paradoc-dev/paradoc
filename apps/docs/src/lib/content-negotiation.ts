/** The representations a docs page has. */
export type Representation = "html" | "markdown";

interface MediaRange {
  type: string;
  subtype: string;
  q: number;
  position: number;
}

function parseAccept(header: string): MediaRange[] {
  const ranges: MediaRange[] = [];
  for (const [position, part] of header.split(",").entries()) {
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
    ranges.push({ type, subtype, q, position });
  }
  return ranges;
}

/** The most specific range that covers `type/subtype`, as RFC 9110 defines. */
function match(ranges: MediaRange[], type: string, subtype: string) {
  const specificity = (range: MediaRange) =>
    range.type === type && range.subtype === subtype
      ? 3
      : range.type === type && range.subtype === "*"
        ? 2
        : range.type === "*" && range.subtype === "*"
          ? 1
          : 0;
  let best: { range: MediaRange; rank: number } | undefined;
  for (const range of ranges) {
    const rank = specificity(range);
    if (rank > 0 && (!best || rank > best.rank)) best = { range, rank };
  }
  return best;
}

/**
 * Pick the representation an `Accept` header asks for, or null when it accepts
 * neither. A missing header and wildcards give HTML. Markdown wins only when the
 * caller ranks it above HTML, or names it first at equal weight.
 */
export function negotiateRepresentation(
  accept: string | null,
): Representation | null {
  if (!accept?.trim()) return "html";
  const ranges = parseAccept(accept);
  const html = match(ranges, "text", "html");
  const markdown = match(ranges, "text", "markdown");
  const htmlQ = html?.range.q ?? 0;
  const markdownQ = markdown?.range.q ?? 0;

  if (htmlQ === 0 && markdownQ === 0) return null;
  if (markdownQ !== htmlQ) return markdownQ > htmlQ ? "markdown" : "html";
  if (markdown?.rank === 3 && html?.rank === 3) {
    return markdown.range.position < html.range.position ? "markdown" : "html";
  }
  return "html";
}

/**
 * Split a request path into page slugs. `explicit` marks an explicit Markdown
 * URL such as `/concepts.md`; `/index.md` and `/guides/index.md` name the root
 * and folder pages. Returns null for a path with malformed percent-encoding.
 */
export function parseContentPath(
  pathname: string,
): { slugs: string[]; explicit: boolean } | null {
  let segments: string[];
  try {
    segments = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    return null;
  }
  const last = segments.at(-1);
  if (last && last.length > ".md".length && last.endsWith(".md")) {
    const slugs = [...segments.slice(0, -1), last.slice(0, -".md".length)];
    if (slugs.at(-1) === "index") slugs.pop();
    return { slugs, explicit: true };
  }
  return { slugs: segments, explicit: false };
}
