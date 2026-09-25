import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { LTR_ISOLATE_STYLESHEET, TYPOGRAPHY_SAFELIST_PATTERNS } from "@paradoc/react";

const START = "/* generated:shared-render-vocabulary:start */";
const END = "/* generated:shared-render-vocabulary:end */";

export function sharedRenderStyles(): string {
  const sources = TYPOGRAPHY_SAFELIST_PATTERNS.map((pattern) => `@source inline("${pattern}");`);
  return [START, ...sources, LTR_ISOLATE_STYLESHEET, END].join("\n");
}

export function replaceSharedRenderStyles(css: string): string {
  const start = css.indexOf(START);
  const end = css.indexOf(END);
  if (start < 0 || end <= start) {
    throw new Error("styles.css must contain the ordered shared-render-vocabulary start and end markers");
  }
  return `${css.slice(0, start)}${sharedRenderStyles()}${css.slice(end + END.length)}`;
}

export function generateSharedStyles(): void {
  const path = fileURLToPath(new URL("../src/styles.css", import.meta.url));
  const css = readFileSync(path, "utf8");
  writeFileSync(path, replaceSharedRenderStyles(css));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) generateSharedStyles();
