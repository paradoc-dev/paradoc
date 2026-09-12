/** @jsxRuntime classic */
import React from "react";

/**
 * Demo composition for the `/components/blocks/invoice` docs page's Preview.
 *
 * `InvoiceDocument` renders bare — no self-wrapping `Pages` — because it is
 * meant to sit inside whatever pagination or packet a caller supplies. A
 * block's Preview shows the full, paginated document the way a consumer who
 * installs it would actually render it, so this wraps it exactly the way
 * that consumer would: `<Pages><InvoiceDocument /></Pages>`. Bound to the
 * short sample, which fits inside one page; see `InvoiceBlockVariantOverflow`
 * for the sample whose table runs past two breaks.
 */

import { Pages } from "../components/pages";
import { shortInvoiceData } from "./invoice-data";
import { InvoiceDocument } from "./invoice-document";

export function InvoiceBlockPreview() {
  return (
    <Pages>
      <InvoiceDocument data={shortInvoiceData} />
    </Pages>
  );
}
