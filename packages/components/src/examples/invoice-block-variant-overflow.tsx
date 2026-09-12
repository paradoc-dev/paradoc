/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/blocks/invoice` docs page's "Overflow" variant: the
 * 48-row sample runs the line-item table past two page breaks, so `Pages`
 * lays the same bare `InvoiceDocument` tree out across several sheets and
 * repeats the table's header on every page it continues onto. This is the
 * block's second real sample-data scenario (see `invoice-data.ts`), not a
 * new prop configuration — a block's Variants section shows only what
 * already exists.
 */

import { Pages } from "../components/pages";
import { overflowInvoiceData } from "./invoice-data";
import { InvoiceDocument } from "./invoice-document";

export function InvoiceBlockVariantOverflow() {
  return (
    <Pages>
      <InvoiceDocument data={overflowInvoiceData} />
    </Pages>
  );
}
