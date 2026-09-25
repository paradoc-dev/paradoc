import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import * as examples from "../src/examples";

const exportedPreviews = Object.entries(examples).filter(
  ([name, value]) =>
    typeof value === "function" && /(?:Demo$|Variant|BlockPreview$)/u.test(name)
) as [string, ComponentType][];

describe("exported example previews", () => {
  it("finds every documented preview family", () => {
    expect(exportedPreviews.length).toBeGreaterThan(80);
  });

  it.each(exportedPreviews)("static-renders %s with default props", (_name, Component) => {
    expect(() => renderToStaticMarkup(createElement(Component))).not.toThrow();
  });
});
