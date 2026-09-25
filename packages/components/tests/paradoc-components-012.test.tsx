/** Regression for the unreachable raw-def fallback in `Totals`. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Document, Totals } from "../src";
import { purchaseOrderData } from "../src/examples/purchase-order-data";
import { purchaseOrderForm } from "../src/examples/purchase-order";

describe("paradoc-components-012", () => {
  it("uses the definition label when the row has no override", () => {
    const html = renderToStaticMarkup(
      <Document artifact={purchaseOrderForm} data={purchaseOrderData}>
        <Totals rows={[{ def: "subtotal" }]} />
      </Document>
    );

    expect(html).toContain("Subtotal");
    expect(html).not.toMatch(/<span[^>]*>subtotal<\/span>/);
  });
});
