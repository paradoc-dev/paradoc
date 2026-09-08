import { fromJsx } from "@takumi-rs/helpers/jsx";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { purchaseOrderData, purchaseOrderForm } from "@paradoc/react/examples";
import { Document, Field, Table, Totals } from "../src";

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
