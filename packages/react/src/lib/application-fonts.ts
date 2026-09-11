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
  const requests: Promise<FontFace[]>[] = [];
  for (const element of [root, ...root.querySelectorAll("*")]) {
    const style = getComputedStyle(element);
    for (const family of style.fontFamily.split(",")) used.add(unquote(family));
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
      const source = sourceUrl(face);
      if (source === undefined) continue;
      const absolute = new URL(source, sheet.href ?? document.baseURI).href;
      const response = await fetch(absolute);
      if (!response.ok) throw new Error(`Could not load font face "${family}" from ${absolute}: HTTP ${response.status}.`);
      const bytes = await response.arrayBuffer();
      resources.push({
        family,
        source: absolute,
        weight: face.style.getPropertyValue("font-weight") || "400",
        style: face.style.getPropertyValue("font-style") || "normal",
        unicodeRange: face.style.getPropertyValue("unicode-range") || undefined,
        integrity: await sha256(bytes),
      });
    }
  }
  resources.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const identity = await sha256(new TextEncoder().encode(JSON.stringify(resources)).buffer);
  return { resources, identity, css: css.join("\n") };
}
