/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/totals` docs page's "Single row" variant: one emphasized
 * def, for a document with nothing to subtotal separately.
 */

import { Document } from "../components/document";
import { Totals } from "../components/totals";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function TotalsVariantSingleRow() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="totals-variant-single-row">
      <Totals rows={[{ def: "total", emphasis: true }]} />
    </Document>
  );
}
