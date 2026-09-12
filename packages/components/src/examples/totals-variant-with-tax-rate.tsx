/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/totals` docs page's "With tax rate" variant: `ratePath`
 * prints the rate field beside the tax row's own label.
 */

import { Document } from "../components/document";
import { Totals } from "../components/totals";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function TotalsVariantWithTaxRate() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="totals-variant-with-tax-rate">
      <Totals rows={[{ def: "subtotal" }, { def: "tax", ratePath: "taxRatePercent" }]} />
    </Document>
  );
}
