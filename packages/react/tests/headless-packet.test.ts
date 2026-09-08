import { describe, expect, it } from "vitest";
import { resolvePartPlacement } from "../src/headless/packet";

describe("headless packet placement", () => {
  it("publishes current page numbers", () => {
    expect(resolvePartPlacement({ firstPage: 3, pageCount: 2, placedFor: "sha256:a", packetHash: "sha256:a" }))
      .toEqual({ state: "placed", label: "Packet pages 3 to 4", firstPage: 3, pageCount: 2 });
  });

  it("suppresses stale page numbers", () => {
    expect(resolvePartPlacement({ firstPage: 3, pageCount: 2, placedFor: "sha256:a", packetHash: "sha256:b" }))
      .toEqual({ state: "pending", label: "Pages pending" });
  });

  it("distinguishes attachments from unplaced parts", () => {
    expect(resolvePartPlacement({ attached: true })).toEqual({ state: "attached", label: "Attached, not paginated" });
    expect(resolvePartPlacement({})).toEqual({ state: "unplaced", label: null });
  });
});
