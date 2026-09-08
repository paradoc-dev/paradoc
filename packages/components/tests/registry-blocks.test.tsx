/**
 * What the four blocks promise, checked on the sources they ship.
 *
 * A block is a whole document, so the claim is not that its files parse: it is
 * that the artifact declares a React layer, that the composition renders that
 * artifact with the sample data travelling beside it, on screen and to PDF, and
 * that the packet's bundle names the very artifact the other block installs.
 * The install itself — the stock CLI, a scratch project, `tsc` over what lands
 * — is `tests/registry/install.test.ts`, and the packet's seal is
 * `tests/vendor-packet-seal.test.tsx`.
 *
 * Everything here reads the block's files through the manifest rather than by
 * importing them directly, so a manifest that stops shipping one of them fails
 * this suite instead of quietly shipping a block that cannot render.
 */

import path from "node:path";
import { fromJsx } from "@takumi-rs/helpers/jsx";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";

import { REGISTRY_ITEMS } from "../scripts/registry/manifest";
import { EngagementLetterDocument } from "../src/examples/engagement-letter-document";
import { engagementLetterData } from "../src/examples/engagement-letter-data";
import {
  engagementLetterForm,
  ENGAGEMENT_LETTER_REACT_LAYER,
  ENGAGEMENT_LETTER_SIGNATURE_SLOTS,
} from "../src/examples/engagement-letter";
import { InvoiceDocument } from "../src/examples/invoice-document";
import { overflowInvoiceData, shortInvoiceData } from "../src/examples/invoice-data";
import { invoiceForm, INVOICE_REACT_LAYER } from "../src/examples/invoice";
import { PurchaseOrderDocument } from "../src/examples/purchase-order-document";
import { purchaseOrderData } from "../src/examples/purchase-order-data";
import { purchaseOrderForm, PURCHASE_ORDER_REACT_LAYER } from "../src/examples/purchase-order";
import { VENDOR_PACKET_KEYS, vendorPacketBundle } from "../src/examples/vendor-packet";
import { vendorPacketData, vendorPacketTaxpayerData } from "../src/examples/vendor-packet-data";
import { planPages, type MeasuredKeep } from "@paradoc/react";
import { renderPdf } from "@paradoc/react-pdf";
import { readPdf, type ReadPage } from "./pdf-reader";
import { normalizeText, treeKeeps } from "./tree-keeps";

/** The manifest's source paths for one block, relative to `src/`. */
function shipped(name: string): string[] {
  const item = REGISTRY_ITEMS.find((candidate) => candidate.name === name);
  expect(item, `no registry item "${name}"`).toBeDefined();
  expect(item?.type).toBe("registry:block");
  return (item?.files ?? []).map((file) => file.path);
}

/** The table header, as the composition writes it. */
const HEADER_TEXT = normalizeText("Description Qty Unit Unit price Amount");

let pages: ReadPage[];
let hinted: ReadPage[];
let hintedRepeats: string[][];

beforeAll(async () => {
  pages = await readPdf(
    (await renderPdf(<PurchaseOrderDocument data={purchaseOrderData} />)).bytes
  );

  // A plan is a browser measurement and this file has no browser, so the keeps
  // are the ones the render itself resolves and only the heights are invented.
  // What it proves is the hinted path: the preview decides the breaks and the
  // engine copies the table header onto every page it said to.
  const { node } = await fromJsx(<PurchaseOrderDocument data={purchaseOrderData} />);
  let y = 0;
  const keeps: MeasuredKeep[] = treeKeeps(node).map(({ id, table, tableHeader }) => {
    const laid = { id, table, tableHeader, top: y, bottom: y + 100 };
    y = laid.bottom;
    return laid;
  });
  const plan = planPages(keeps, 900);
  hintedRepeats = plan.repeats;
  const rendered = await renderPdf(<PurchaseOrderDocument data={purchaseOrderData} />, { plan });
  expect(rendered.unknownBreaks).toEqual([]);
  expect(rendered.unknownRepeats).toEqual([]);
  hinted = await readPdf(rendered.bytes);
}, 180_000);

describe("the purchase order block", () => {
  it("ships the artifact, its data and the composition that binds them", () => {
    expect(shipped("purchase-order")).toEqual([
      "examples/purchase-order.ts",
      "examples/purchase-order-data.ts",
      "examples/purchase-order-document.tsx",
    ]);
  });

  it("ships an artifact whose default layer is a React layer", () => {
    const layer = purchaseOrderForm.layers?.[PURCHASE_ORDER_REACT_LAYER];
    expect(purchaseOrderForm.defaultLayer).toBe(PURCHASE_ORDER_REACT_LAYER);
    expect(layer).toMatchObject({ kind: "file", mimeType: "text/tsx" });
    expect(path.posix.basename(String((layer as { path?: string }).path))).toBe(
      "purchase-order-document.tsx"
    );
  });

  it("renders live with the sample order it ships", () => {
    const html = renderToStaticMarkup(<PurchaseOrderDocument data={purchaseOrderData} />);
    expect(html).toContain("Purchase Order");
    expect(html).toContain("Northgate Systems");
    // The values a reader checks: the buyer's order number, a line item, and
    // the total the artifact's defs compute rather than the composition.
    expect(html).toContain("PO-2026-0512");
    expect(html).toContain("Rack-mount UPS, 3000VA");
    expect(html).toContain("$131,811.70");
  });

  it("renders to PDF with the same data, over the three pages the packet needs", () => {
    expect(pages.length).toBeGreaterThanOrEqual(3);
    expect(pages[0]?.text).toContain("Purchase Order");
    expect(pages[0]?.text).toContain("PO-2026-0512");
    // The line items run past two page breaks, the artifact's computed totals
    // land after them, and the acceptance block closes the document. All three
    // sit past page one, which is the sample's whole reason for its length.
    const continued = pages.slice(1).map((page) => page.text).join(" ");
    expect(continued).toContain("Site survey and as-built drawings");
    expect(continued).toContain("Total $131,811.70");
    expect(pages.at(-1)?.text).toContain("Signature (required)");
  });

  it("repeats the table header on every continued page of a hinted render", () => {
    // The engine paginating itself does not copy a header; the preview's plan
    // is what asks for one, and the block's sample is long enough that the plan
    // asks several times over. Without a floor this would pass on a plan that
    // copied nothing at all.
    const copied = hintedRepeats.filter((copies) => copies.length > 0);
    expect(copied.length).toBeGreaterThanOrEqual(2);

    hintedRepeats.forEach((copies, index) => {
      if (copies.length === 0) return;
      expect(copies).toEqual(["line-items:header"]);
      expect(normalizeText(hinted[index]!.text)).toContain(HEADER_TEXT);
    });
  });
});

describe("the vendor packet block", () => {
  it("ships the bundle artifact, the annex bytes, the sample and the composition", () => {
    expect(shipped("vendor-packet")).toEqual([
      "examples/vendor-packet.ts",
      "examples/vendor-packet-annex.ts",
      "examples/vendor-packet-data.ts",
      "examples/vendor-packet-document.tsx",
    ]);
  });

  it("names @paradoc/essentials, which the installed packet cannot be sealed without", () => {
    // Nothing the block ships imports it. The packet's second part is the W-9,
    // and the sample carries the taxpayer's values rather than the artifact.
    const item = REGISTRY_ITEMS.find((candidate) => candidate.name === "vendor-packet");
    expect(item?.dependencies).toContain("@paradoc/essentials");
  });

  it("ships a sample for every part it declares", () => {
    expect(vendorPacketData.purchaseOrder).toBe(purchaseOrderData);
    expect(vendorPacketData.taxpayer).toBe(vendorPacketTaxpayerData);
    // The annex is a real PDF, carried as bytes because a browser project has
    // no engine to draw one with.
    expect(vendorPacketData.insurance.length).toBeGreaterThan(1000);
    expect(Array.from(vendorPacketData.insurance.slice(0, 5))).toEqual([0x25, 0x50, 0x44, 0x46, 0x2d]);
  });

  it("gives the W-9 the supplier the purchase order names", () => {
    expect(vendorPacketTaxpayerData.fields.businessName).toBe("Northgate Systems, LLC");
    expect(vendorPacketTaxpayerData.fields.ein).toBe(
      (purchaseOrderData.fields.supplier as { taxId: string }).taxId
    );
  });

  it("brings the purchase order with it, because the order is one of its parts", () => {
    const item = REGISTRY_ITEMS.find((candidate) => candidate.name === "vendor-packet");
    expect(item?.registryDependencies).toContain("purchase-order");
  });

  it("names the very artifact the purchase order block installs", () => {
    // The two blocks install one artifact between them. A packet declaring its
    // own copy would seal a document nobody edited.
    const order = vendorPacketBundle.contents.find(
      (content) => content.key === VENDOR_PACKET_KEYS.purchaseOrder
    );
    expect(order?.type).toBe("inline");
    expect(order && "artifact" in order ? order.artifact : undefined).toEqual(purchaseOrderForm);
  });

  it("declares one part of each kind a packet can hold", () => {
    expect(vendorPacketBundle.contents.map((content) => [content.key, content.type])).toEqual([
      [VENDOR_PACKET_KEYS.purchaseOrder, "inline"],
      [VENDOR_PACKET_KEYS.taxpayer, "registry"],
      [VENDOR_PACKET_KEYS.insurance, "inline"],
    ]);
  });
});

describe("the invoice block", () => {
  it("ships the artifact, its data and the composition that binds them", () => {
    expect(shipped("invoice")).toEqual([
      "examples/invoice.ts",
      "examples/invoice-data.ts",
      "examples/invoice-document.tsx",
    ]);
  });

  it("ships an artifact whose default layer is a React layer with no signature slot", () => {
    const layer = invoiceForm.layers?.[INVOICE_REACT_LAYER];
    expect(invoiceForm.defaultLayer).toBe(INVOICE_REACT_LAYER);
    expect(layer).toMatchObject({ kind: "file", mimeType: "text/tsx" });
    expect(path.posix.basename(String((layer as { path?: string }).path))).toBe(
      "invoice-document.tsx"
    );
    // Nothing signs an invoice, so the block installs no `signature` component.
    expect(layer?.signatures).toBeUndefined();
    const item = REGISTRY_ITEMS.find((candidate) => candidate.name === "invoice");
    expect(item?.registryDependencies).not.toContain("signature");
  });

  it("renders live with both samples it ships", () => {
    const short = renderToStaticMarkup(<InvoiceDocument data={shortInvoiceData} />);
    expect(short).toContain("Invoice");
    expect(short).toContain("INV-2026-0431");
    expect(short).toContain("Northgate Systems");
    // The mark is a token, resolved from bytes to a `data:` URI, so the
    // installed block draws it without fetching anything.
    expect(short).toContain("data:image/png;base64,");
    // The total the artifact's defs compute rather than the composition.
    expect(short).toContain("$57,426.63");

    const overflow = renderToStaticMarkup(<InvoiceDocument data={overflowInvoiceData} />);
    expect(overflow).toContain("INV-2026-0432");
    expect(overflow).toContain("Release pipeline maintenance — September");
  });

  it("renders the long sample to a PDF whose table crosses a page break", async () => {
    const read = await readPdf(
      (await renderPdf(<InvoiceDocument data={overflowInvoiceData} />)).bytes
    );
    expect(read.length).toBeGreaterThanOrEqual(2);
    expect(read[0]?.text).toContain("INV-2026-0432");
    const continued = read.slice(1).map((page) => page.text).join(" ");
    expect(continued).toContain("Amount due");
  }, 180_000);
});

describe("the engagement letter block", () => {
  it("ships the artifact, its data and the composition that binds them", () => {
    expect(shipped("engagement-letter")).toEqual([
      "examples/engagement-letter.ts",
      "examples/engagement-letter-data.ts",
      "examples/engagement-letter-document.tsx",
    ]);
  });

  it("ships an artifact whose React layer declares a flow slot per party", () => {
    const layer = engagementLetterForm.layers?.[ENGAGEMENT_LETTER_REACT_LAYER];
    expect(engagementLetterForm.defaultLayer).toBe(ENGAGEMENT_LETTER_REACT_LAYER);
    expect(layer).toMatchObject({ kind: "file", mimeType: "text/tsx" });
    expect(path.posix.basename(String((layer as { path?: string }).path))).toBe(
      "engagement-letter-document.tsx"
    );
    expect(Object.keys(layer?.signatures ?? {})).toEqual(
      Object.values(ENGAGEMENT_LETTER_SIGNATURE_SLOTS)
    );
    const item = REGISTRY_ITEMS.find((candidate) => candidate.name === "engagement-letter");
    expect(item?.registryDependencies).toContain("signature");
    // A letter prices nothing and lists nothing in rows.
    expect(item?.registryDependencies).not.toContain("table");
    expect(item?.registryDependencies).not.toContain("totals");
  });

  it("renders live with the sample it ships, numbering every clause", () => {
    const html = renderToStaticMarkup(<EngagementLetterDocument data={engagementLetterData} />);
    expect(html).toContain("Engagement Letter");
    expect(html).toContain("Ashgrove Rowan");
    expect(html).toContain("AR-2026-0917");
    const clauses = engagementLetterData.fields.scopeOfServices as { heading: string }[];
    clauses.forEach((clause, index) => {
      expect(html).toContain(clause.heading);
      // Each clause is one keep, so the plan can move it whole.
      expect(html).toContain(`data-keep-id="clause:${index}"`);
    });
    expect(html).toContain("Signature (required)");
  });
});
