import { fromJsx } from "@takumi-rs/helpers/jsx";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { purchaseOrderData } from "../src/examples/purchase-order-data";
import { purchaseOrderForm } from "../src/examples/purchase-order";
import { Document, Field, Part, Signature, Table, Totals } from "../src";

it("renders copy-owned markup through public @paradoc/react bindings", async () => {
  const element = (
    <Document artifact={purchaseOrderForm} data={purchaseOrderData}>
      <Field path="orderNumber" />
      <Table path="lineItems" columns={[{ field: "description" }, { field: "amount" }]} />
      <Totals rows={[{ def: "subtotal" }, { def: "total", emphasis: true }]} />
    </Document>
  );
  const html = renderToStaticMarkup(element);
  expect(html).toContain("PO-2026-0512");
  expect(html).toContain("27-inch 4K monitor");
  expect(html).toContain("$131,811.70");
  const tree = await fromJsx(element);
  expect(JSON.stringify(tree.node)).toContain("PO-2026-0512");
});

it("composes signing and truthful packet placement from headless bindings", () => {
  const html = renderToStaticMarkup(
    <Part id="order" kind="composition" label="Order" firstPage={2} pageCount={1} placedFor="sha256:old" packetHash="sha256:new">
      <Document artifact={purchaseOrderForm} data={purchaseOrderData}>
        <Signature party="buyer" />
        <Signature party="buyer" index={0} type="initials" />
        <Signature party="buyer" index={1} />
      </Document>
    </Part>
  );
  expect(html).toContain("Pages pending");
  expect(html).not.toContain("data-part-first-page");
  expect(html).toContain("Signature (required)");
  expect(html).toContain("Initials (required)");
  expect(html).toContain('data-keep-id="signature:buyer"');
  expect(html).toContain('data-keep-id="initials:buyer"');
  expect(html).toContain('data-keep-id="signature:buyer:1"');
});
