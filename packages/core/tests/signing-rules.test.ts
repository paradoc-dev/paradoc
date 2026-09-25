import { describe, expect, it } from "vitest";

import { INITIALS_RULE, SIGNATURE_RULE } from "../src";

describe("flow signing rules", () => {
  it("publishes the visible placeholders used by the seal flow", () => {
    expect(SIGNATURE_RULE).toBe("________________");
    expect(INITIALS_RULE).toBe("______");
  });
});
