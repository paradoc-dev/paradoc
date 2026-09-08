// @vitest-environment jsdom
/**
 * The packet's parts, as markup.
 *
 * A packet on screen is a sequence of documents, and what makes it one rather
 * than a run-on document is the boundary between the parts and the numbering
 * inside each. Both are markup, so both are checked here; painting itself needs
 * a canvas and is checked in the browser.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Attachment } from "../../components/src/components/pdf-pages";
import { Part } from "../../components/src/components/part";
import { PurchaseOrderDocument } from "../../components/src/examples";
import { purchaseOrderData } from "../../components/src/examples";

function parse(markup: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = markup;
  return host;
}

describe("a part", () => {
  const host = parse(
    renderToStaticMarkup(
      <Part id="purchase-order" kind="composition" label="Purchase order" firstPage={1} pageCount={2}>
        <PurchaseOrderDocument data={purchaseOrderData} />
      </Part>
    )
  );
  const section = host.querySelector("[data-part-id]")!;

  it("names itself, its kind and where it sits in the packet", () => {
    expect(section.getAttribute("data-part-id")).toBe("purchase-order");
    expect(section.getAttribute("data-part-kind")).toBe("composition");
    expect(section.getAttribute("data-part-first-page")).toBe("1");
    expect(section.getAttribute("data-part-page-count")).toBe("2");
  });

  it("says which packet pages it occupies", () => {
    expect(section.querySelector("[data-part-label]")!.textContent).toContain("Packet pages 1 to 2");
  });

  it("holds one document and its keeps", () => {
    expect(section.querySelectorAll("[data-document-id]")).toHaveLength(1);
    expect(section.querySelectorAll("[data-keep-id]").length).toBeGreaterThan(10);
  });

  it("says nothing about the packet when the caller has not sealed it", () => {
    const unplaced = parse(
      renderToStaticMarkup(
        <Part id="annex" kind="annex" label="Annex">
          <p>nothing yet</p>
        </Part>
      )
    );
    expect(unplaced.querySelector("[data-part-label]")!.textContent).toBe("Annex");
    expect(unplaced.querySelector("[data-part-id]")!.getAttribute("data-part-placement")).toBe("unplaced");
  });
});

describe("a part that is attached rather than paginated", () => {
  const host = parse(
    renderToStaticMarkup(
      <Part id="scan" kind="annex" label="Scan" firstPage={0} pageCount={0} attached packetHash="sha256:a">
        <p>an attachment</p>
      </Part>
    )
  );
  const section = host.querySelector("[data-part-id]")!;

  it("says so rather than naming pages it does not have", () => {
    expect(host.querySelector("[data-part-label]")!.textContent).toContain("Attached, not paginated");
    expect(host.querySelector("[data-part-label]")!.textContent).not.toContain("0");
  });

  it("states no page numbers at all", () => {
    expect(section.getAttribute("data-part-placement")).toBe("attached");
    expect(section.getAttribute("data-part-first-page")).toBeNull();
    expect(section.getAttribute("data-part-page-count")).toBeNull();
  });
});

describe("a part whose placement is stale", () => {
  const stale = (
    <Part
      id="purchase-order"
      kind="composition"
      label="Purchase order"
      firstPage={1}
      pageCount={2}
      placedFor="sha256:sealed"
      packetHash="sha256:on-screen"
    >
      <p>a document that has changed</p>
    </Part>
  );

  it("says its pages are pending rather than naming a page the packet no longer has", () => {
    const host = parse(renderToStaticMarkup(stale));
    expect(host.querySelector("[data-part-label]")!.textContent).toContain("Pages pending");
    expect(host.querySelector("[data-part-id]")!.getAttribute("data-part-placement")).toBe("pending");
    expect(host.querySelector("[data-part-id]")!.getAttribute("data-part-first-page")).toBeNull();
  });

  it("names the pages again once the hashes agree", () => {
    const host = parse(
      renderToStaticMarkup(
        <Part
          id="purchase-order"
          kind="composition"
          label="Purchase order"
          firstPage={1}
          pageCount={2}
          placedFor="sha256:sealed"
          packetHash="sha256:sealed"
        >
          <p>a document that has changed</p>
        </Part>
      )
    );
    expect(host.querySelector("[data-part-label]")!.textContent).toContain("Packet pages 1 to 2");
    expect(host.querySelector("[data-part-id]")!.getAttribute("data-part-placement")).toBe("placed");
  });
});

describe("an attachment", () => {
  const host = parse(
    renderToStaticMarkup(
      <Attachment
        filename="certificate.tiff"
        mimeType="image/tiff"
        byteLength={2048}
        reason="This scan could not be painted, so it is carried as an attachment."
      />
    )
  );

  it("names the file, the type and the size", () => {
    const card = host.querySelector("[data-attachment]")!;
    expect(card.getAttribute("data-attachment")).toBe("certificate.tiff");
    expect(card.textContent).toContain("certificate.tiff");
    expect(card.textContent).toContain("image/tiff");
    expect(card.textContent).toContain("2 KB");
  });

  it("says why it is an attachment rather than pages", () => {
    expect(host.querySelector("[data-attachment-reason]")!.textContent).toContain(
      "could not be painted"
    );
  });
});
