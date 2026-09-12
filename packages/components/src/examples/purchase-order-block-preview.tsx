/** @jsxRuntime classic */
import React from "react";

/**
 * Demo composition for the `/components/blocks/purchase-order` docs page's
 * Preview (and its "Standard order" Variant — see the block's docs page for
 * why the same render backs both: the block has one real sample-data
 * scenario today, not two).
 *
 * `PurchaseOrderDocument` renders bare — no self-wrapping `Pages` — because
 * it is meant to sit inside whatever pagination or packet a caller supplies.
 * A block's Preview shows the full, paginated document the way a consumer
 * who installs it would actually render it, so this wraps it exactly the
 * way that consumer would: `<Pages><PurchaseOrderDocument /></Pages>`. The
 * sample's 32 rows already run past two page breaks, so the header repeats
 * without needing a second, longer scenario.
 */

import { Pages } from "../components/pages";
import { purchaseOrderData } from "./purchase-order-data";
import { PurchaseOrderDocument } from "./purchase-order-document";

export function PurchaseOrderBlockPreview() {
  return (
    <Pages>
      <PurchaseOrderDocument data={purchaseOrderData} />
    </Pages>
  );
}
