import { describe, expect, it, vi } from "vitest";

vi.mock("../src/adapters/chromium", () => {
  throw new SyntaxError("The requested module 'tailwindcss' does not provide an export named 'compile'");
});

describe("paradoc-react-pdf-004", () => {
  it("does not relabel an incompatible peer as missing", async () => {
    const { MissingAdapterPeerError, renderPdf } = await import("../src");
    await expect(renderPdf(<div>Hello</div>, { adapter: "chromium" }))
      .rejects.not.toBeInstanceOf(MissingAdapterPeerError);
  });
});
