import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const bindings = vi.hoisted(() => ({ usePdfPages: vi.fn() }));

vi.mock("@paradoc/react", async (load) => {
  const actual = await load<typeof import("@paradoc/react")>();
  return {
    ...actual,
    usePdfPages: bindings.usePdfPages,
    useFitToWidth: () => ({ scale: 1, height: 600 }),
  };
});

import { PdfPages } from "../src/components/pdf-pages";

describe("PdfPages", () => {
  beforeEach(() => bindings.usePdfPages.mockReset());

  it("switches to a named attachment when painting fails", () => {
    bindings.usePdfPages.mockReturnValue({ status: "attachment", pages: [], attachmentReason: "encrypted PDF" });
    const html = renderToStaticMarkup(<PdfPages bytes={new Uint8Array(1536)} filename="locked.pdf" />);
    expect(html).toContain("locked.pdf");
    expect(html).toContain("2 KB");
    expect(html).toContain("encrypted PDF");
  });

  it("marks every painted page with its dimensions and accessible name", () => {
    bindings.usePdfPages.mockReturnValue({
      status: "painted",
      attachmentReason: null,
      pages: [{ pageNumber: 2, src: "data:image/png;base64,AA==", widthPx: 612, heightPx: 792 }],
    });
    const html = renderToStaticMarkup(<PdfPages bytes={new Uint8Array([1])} filename="part.pdf" />);
    expect(html).toContain('data-painted-stack="part.pdf"');
    expect(html).toContain('data-painted-page="true"');
    expect(html).toContain('data-page="2"');
    expect(html).toContain('alt="part.pdf page 2"');
    expect(html).toContain('width="612"');
    expect(html).toContain('height="792"');
  });
});
