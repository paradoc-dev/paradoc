/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/totals` docs page's "Custom label" variant: `label`
 * overrides the total def's own label.
 */

import { Document } from "../components/document";
import { Totals } from "../components/totals";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function TotalsVariantCustomLabel() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="totals-variant-custom-label">
      <Totals rows={[{ def: "total", label: "Amount due", emphasis: true }]} />
    </Document>
  );
}
