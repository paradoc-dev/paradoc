import { describe, expect, it } from "vitest";

import { renderPdf } from "../src";
import { checkComposition } from "../src/check";
import { chromiumAdapter } from "../src/chromium";

describe("the explicit PDF integration", () => {
  it("exposes rendering, checking, and Chromium only from its named entries", () => {
    expect(renderPdf).toBeTypeOf("function");
    expect(checkComposition).toBeTypeOf("function");
    expect(chromiumAdapter.name).toBe("chromium");
  });
});
