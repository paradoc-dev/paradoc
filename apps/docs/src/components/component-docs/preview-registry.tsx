/** Live previews derived from the exports of the component examples package. */
import type { ComponentType } from "react";
import * as examples from "@paradoc/components/examples";

function kebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

const exported = Object.entries(examples).filter(
  ([, value]) => typeof value === "function",
) as [string, ComponentType][];

export const COMPONENT_DEMOS: Record<string, ComponentType> = Object.fromEntries(
  exported.flatMap(([name, component]) => {
    if (name.endsWith("BlockPreview")) {
      return [[kebabCase(name.slice(0, -"BlockPreview".length)), component]];
    }
    if (name.endsWith("Demo")) {
      return [[kebabCase(name.slice(0, -"Demo".length)), component]];
    }
    return [];
  }),
);

export const COMPONENT_VARIANTS: Record<string, Record<string, ComponentType>> = {};
for (const [exportName, component] of exported) {
  const marker = exportName.indexOf("Variant");
  if (marker < 0) continue;
  const name = kebabCase(exportName.slice(0, marker).replace(/Block$/, ""));
  const variant = kebabCase(exportName.slice(marker + "Variant".length));
  const variants = COMPONENT_VARIANTS[name] ?? {};
  variants[variant] = component;
  COMPONENT_VARIANTS[name] = variants;
}
for (const [name, component] of Object.entries(COMPONENT_DEMOS)) {
  if (name === "invoice" || !name.includes("-")) continue;
  COMPONENT_VARIANTS[name] ??= { standard: component };
}
for (const name of ["purchase-order", "vendor-packet", "engagement-letter"]) {
  COMPONENT_VARIANTS[name] ??= { standard: COMPONENT_DEMOS[name] };
}
