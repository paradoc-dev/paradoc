import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TYPOGRAPHY_SAFELIST_PATTERNS, flowGapClasses, scaleTextClasses } from "@paradoc/react";
import { replaceSharedRenderStyles, sharedRenderStyles } from "../scripts/generate-shared-styles";

const css = readFileSync(fileURLToPath(new URL("../src/styles.css", import.meta.url)), "utf8");

function expand(pattern: string): string[] {
  const open = pattern.indexOf("{");
  if (open < 0) return [pattern];
  let depth = 0; let close = open;
  for (let i = open; i < pattern.length; i++) {
    if (pattern[i] === "{") depth++;
    if (pattern[i] === "}" && --depth === 0) { close = i; break; }
  }
  const body = pattern.slice(open + 1, close);
  const parts: string[] = []; depth = 0; let start = 0;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "{") depth++;
    if (body[i] === "}") depth--;
    if (body[i] === "," && depth === 0) { parts.push(body.slice(start, i)); start = i + 1; }
  }
  parts.push(body.slice(start));
  const options = parts.length === 1 && /^\d+\.\.\d+$/.test(parts[0]!)
    ? (() => { const [a, b] = parts[0]!.split("..").map(Number); return Array.from({ length: b! - a! + 1 }, (_, k) => String(a! + k)); })()
    : parts.flatMap(expand);
  return options.flatMap((option) => expand(pattern.slice(close + 1)).map((rest) => pattern.slice(0, open) + option + rest));
}

describe("typography safelist", () => {
  it("refuses to rewrite a stylesheet without ordered generation markers", () => {
    expect(() => replaceSharedRenderStyles("@import tailwindcss;")).toThrow(/ordered shared-render-vocabulary/u);
    expect(() => replaceSharedRenderStyles("/* generated:shared-render-vocabulary:end */\n/* generated:shared-render-vocabulary:start */")).toThrow(/ordered shared-render-vocabulary/u);
  });
  it("is generated from the React scale definition", () => {
    expect(css).toContain(sharedRenderStyles());
  });
  it("contains the previously drifting boundaries", () => {
    expect(flowGapClasses("gap-3.5", "roomy")).toBe("gap-5.5");
    expect(scaleTextClasses("leading-16", "roomy")).toBe("leading-17");
    expect(TYPOGRAPHY_SAFELIST_PATTERNS.join(" ")).toContain("{0..999}.5");
  });

  it("contains every class either helper emits from an admitted class", () => {
    const safelist = new Set(TYPOGRAPHY_SAFELIST_PATTERNS.flatMap((pattern) => pattern.split(/\s+/u).flatMap(expand)));
    const missing = new Set<string>();
    for (const name of safelist) for (const level of ["compact", "roomy"] as const) {
      for (const output of [scaleTextClasses(name, level), flowGapClasses(name, level)]) {
        if (!safelist.has(output)) missing.add(`${name} -> ${output}`);
      }
    }
    expect([...missing]).toEqual([]);
  });
});
