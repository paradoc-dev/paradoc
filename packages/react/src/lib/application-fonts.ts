/** Browser-discovered font resources that can travel with a pagination plan. */
export interface ApplicationFontResource {
  family: string;
  source: string;
  weight?: string;
  style?: string;
  unicodeRange?: string;
  format?: string;
  integrity: string;
}

export interface ApplicationFontSnapshot {
  resources: ApplicationFontResource[];
  identity: string;
  /** Accessible application rules needed to reproduce the styling context. */
  css: string;
}

interface CachedFont {
  value?: { bytes: ArrayBuffer; integrity: string };
  etag?: string;
  lastModified?: string;
  immutable?: boolean;
  pending?: Promise<{ bytes: ArrayBuffer; integrity: string }>;
}
const fontBytes = new Map<string, CachedFont>();

function fetchFont(source: string): Promise<{ bytes: ArrayBuffer; integrity: string }> {
  const cached = fontBytes.get(source) ?? {};
  if (cached.immutable && cached.value !== undefined) return Promise.resolve(cached.value);
  if (cached.pending !== undefined) return cached.pending;
  cached.pending = (async () => {
      const headers = new Headers();
      if (cached.etag) headers.set("If-None-Match", cached.etag);
      if (cached.lastModified) headers.set("If-Modified-Since", cached.lastModified);
      const response = await fetch(source, { headers });
      if (response.status === 304 && cached.value !== undefined) return cached.value;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      const value = { bytes, integrity: await sha256(bytes) };
      cached.value = value;
      cached.etag = response.headers.get("etag") ?? undefined;
      cached.lastModified = response.headers.get("last-modified") ?? undefined;
      cached.immutable = /(?:^|,)\s*immutable(?:,|$)/iu.test(response.headers.get("cache-control") ?? "");
      return value;
    })().catch((error: unknown) => { fontBytes.delete(source); throw error; })
      .finally(() => { cached.pending = undefined; });
  fontBytes.set(source, cached);
  return cached.pending;
}

function unquote(value: string): string {
  return value.trim().replace(/^['"]|['"]$/gu, "");
}

function numericWeight(value: string): number {
  if (value === "normal") return 400;
  if (value === "bold") return 700;
  return Number(value);
}

function faceSource(rule: CSSFontFaceRule, base: string): { url: string; format?: string } | undefined {
  const sources = [...rule.style.getPropertyValue("src").matchAll(/url\((?:['"])?([^'")]+)(?:['"])?\)(?:\s+format\((?:['"])?([^'")]+)(?:['"])?\))?/gu)]
    .map((match) => ({ url: new URL(match[1]!, base).href, format: match[2] }));
  const fetched = new Set(performance.getEntriesByType("resource").map((entry) => entry.name));
  return sources.find((source) => fetched.has(source.url)) ?? sources[0];
}

async function sha256(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

/** Resolve the exact application font faces capable of affecting a rendered subtree. */
export async function captureApplicationFonts(root: Element): Promise<ApplicationFontSnapshot> {
  const used = new Set<string>();
  const requested = new Map<string, { weight: string; style: string; text: string }[]>();
  const requests: Promise<FontFace[]>[] = [];
  for (const element of [root, ...root.querySelectorAll("*")]) {
    const style = getComputedStyle(element);
    const text = element.textContent?.trim();
    const family = unquote(style.fontFamily.split(",")[0] ?? "");
    if (family) {
      used.add(family);
      const descriptors = requested.get(family) ?? [];
      const existing = descriptors.find((entry) => entry.weight === style.fontWeight && entry.style === style.fontStyle);
      if (existing === undefined) {
        descriptors.push({ weight: style.fontWeight, style: style.fontStyle, text: text ?? "" });
        requested.set(family, descriptors);
      } else existing.text += text ?? "";
    }
    if (text) requests.push(document.fonts.load(`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`, text));
  }
  await Promise.all(requests);
  await document.fonts.ready;

  const resources: ApplicationFontResource[] = [];
  const css: string[] = [];
  for (const sheet of [...document.styleSheets]) {
    let rules: CSSRuleList;
    try { rules = sheet.cssRules; } catch { continue; }
    for (const rule of [...rules]) {
      css.push(rule.cssText);
      if (rule.type !== CSSRule.FONT_FACE_RULE) continue;
      const face = rule as CSSFontFaceRule;
      const family = unquote(face.style.getPropertyValue("font-family"));
      if (!used.has(family)) continue;
      const wanted = requested.get(family)!;
      const weight = face.style.getPropertyValue("font-weight") || "400";
      const style = face.style.getPropertyValue("font-style") || "normal";
      const range = weight.split(/\s+/u).map(numericWeight);
      if (!wanted.some((descriptor) => {
        if (style !== descriptor.style) return false;
        const numeric = numericWeight(descriptor.weight);
        return numericWeight(weight) === numeric || (range.length === 2 && numeric >= range[0]! && numeric <= range[1]!);
      })) continue;
      const unicodeRange = face.style.getPropertyValue("unicode-range") || undefined;
      if (unicodeRange !== undefined && !wanted.some((descriptor) => [...descriptor.text].some((character) => {
        const code = character.codePointAt(0)!;
        return unicodeRange.split(",").some((part) => {
          const values = part.trim().replace(/^U\+/iu, "").split("-");
          const start = Number.parseInt(values[0]!.replaceAll("?", "0"), 16);
          const end = Number.parseInt((values[1] ?? values[0]!).replaceAll("?", "F"), 16);
          return code >= start! && code <= end!;
        });
      }))) continue;
      const source = faceSource(face, sheet.href ?? document.baseURI);
      if (source === undefined) continue;
      const absolute = source.url;
      const { integrity } = await fetchFont(absolute).catch((cause: unknown) => {
        throw new Error(`Could not load font face "${family}" from ${absolute}: ${cause instanceof Error ? cause.message : String(cause)}.`);
      });
      resources.push({
        family,
        source: absolute,
        weight,
        style,
        unicodeRange,
        format: source.format ?? (/\.woff2(?:$|\?)/iu.test(absolute) ? "woff2" : /\.woff(?:$|\?)/iu.test(absolute) ? "woff" : /\.ttf(?:$|\?)/iu.test(absolute) ? "truetype" : /\.otf(?:$|\?)/iu.test(absolute) ? "opentype" : undefined),
        integrity,
      });
    }
  }
  resources.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const covered = new Set(resources.map((resource) => resource.family));
  const generics = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "math", "fangsong", "system-ui", "ui-serif", "ui-sans-serif", "ui-monospace", "ui-rounded"]);
  const missing = [...used].filter((family) => !covered.has(family) && !generics.has(family));
  if (missing.length > 0) throw new Error(`No embeddable @font-face resource is available for: ${missing.join(", ")}. Supply reachable application font files before paginating.`);
  const identity = await sha256(new TextEncoder().encode(JSON.stringify({ resources, css: css.join("\n") })).buffer);
  return { resources, identity, css: css.join("\n") };
}
