/** Browser-discovered font resources that can travel with a pagination plan. */
export interface ApplicationFontResource {
  family: string;
  source: string;
  weight?: string;
  style?: string;
  unicodeRange?: string;
  integrity: string;
}

export interface ApplicationFontSnapshot {
  resources: ApplicationFontResource[];
  identity: string;
  /** Accessible application rules needed to reproduce the styling context. */
  css: string;
}

const fontBytes = new Map<string, Promise<{ bytes: ArrayBuffer; integrity: string }>>();

function fetchFont(source: string): Promise<{ bytes: ArrayBuffer; integrity: string }> {
  let pending = fontBytes.get(source);
  if (pending === undefined) {
    pending = (async () => {
      const response = await fetch(source);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      return { bytes, integrity: await sha256(bytes) };
    })().catch((error: unknown) => { fontBytes.delete(source); throw error; });
    fontBytes.set(source, pending);
  }
  return pending;
}

function unquote(value: string): string {
  return value.trim().replace(/^['"]|['"]$/gu, "");
}

function sourceUrl(rule: CSSFontFaceRule): string | undefined {
  const match = rule.style.getPropertyValue("src").match(/url\((?:['"])?([^'")]+)(?:['"])?\)/u);
  return match?.[1];
}

async function sha256(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

/** Resolve the exact application font faces capable of affecting a rendered subtree. */
export async function captureApplicationFonts(root: Element): Promise<ApplicationFontSnapshot> {
  const used = new Set<string>();
  const requested = new Map<string, { weight: string; style: string }>();
  const requests: Promise<FontFace[]>[] = [];
  for (const element of [root, ...root.querySelectorAll("*")]) {
    const style = getComputedStyle(element);
    const family = unquote(style.fontFamily.split(",")[0] ?? "");
    if (family) {
      used.add(family);
      requested.set(family, { weight: style.fontWeight, style: style.fontStyle });
    }
    const text = element.textContent?.trim();
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
      if (style !== wanted.style) continue;
      const range = weight.split(/\s+/u).map(Number);
      const numeric = Number(wanted.weight);
      if (weight !== wanted.weight && !(range.length === 2 && numeric >= range[0]! && numeric <= range[1]!)) continue;
      const source = sourceUrl(face);
      if (source === undefined) continue;
      const absolute = new URL(source, sheet.href ?? document.baseURI).href;
      const { integrity } = await fetchFont(absolute).catch((cause: unknown) => {
        throw new Error(`Could not load font face "${family}" from ${absolute}: ${cause instanceof Error ? cause.message : String(cause)}.`);
      });
      resources.push({
        family,
        source: absolute,
        weight,
        style,
        unicodeRange: face.style.getPropertyValue("unicode-range") || undefined,
        integrity,
      });
    }
  }
  resources.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const covered = new Set(resources.map((resource) => resource.family));
  const generics = new Set(["serif", "sans-serif", "monospace", "system-ui", "ui-serif", "ui-sans-serif", "ui-monospace"]);
  const missing = [...used].filter((family) => !covered.has(family) && !generics.has(family));
  if (missing.length > 0) throw new Error(`No embeddable @font-face resource is available for: ${missing.join(", ")}. Supply reachable application font files before paginating.`);
  const identity = await sha256(new TextEncoder().encode(JSON.stringify(resources)).buffer);
  return { resources, identity, css: css.join("\n") };
}
