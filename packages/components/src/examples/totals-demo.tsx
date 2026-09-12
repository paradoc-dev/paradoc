/** @jsxRuntime classic */
import React from "react";

/**
 * Demo composition for the `/components/totals` docs page.
 *
 * The same subtotal/tax/total breakdown this package's own `ProposalDocument`
 * composition renders (see `proposal-document.tsx`), on its own. This is
 * what the docs page's live Preview renders, and its raw source is what the
 * Composition section shows.
 */

import { Document } from "../components/document";
import { Totals } from "../components/totals";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function TotalsDemo() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="totals-demo">
      <Totals
        rows={[
          { def: "subtotal" },
          { def: "tax", ratePath: "taxRatePercent" },
          { def: "total", emphasis: true },
        ]}
      />
    </Document>
  );
}
