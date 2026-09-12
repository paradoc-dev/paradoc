/** @jsxRuntime classic */
import React from "react";

/**
 * Demo composition for the `/components/table` docs page.
 *
 * The same `lineItems` table this package's own `ProposalDocument`
 * composition renders (see `proposal-document.tsx`), on its own. This is
 * what the docs page's live Preview renders, and its raw source is what the
 * Composition section shows.
 */

import { Document } from "../components/document";
import { Table } from "../components/table";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function TableDemo() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="table-demo">
      <Table
        path="lineItems"
        id="line-items"
        columns={[
          { field: "description", width: "basis-1/2" },
          { field: "quantity", header: "Qty", width: "basis-1/12", align: "right" },
          { field: "unit", width: "basis-1/12" },
          { field: "unitPrice", header: "Unit price", width: "basis-1/6", align: "right" },
          { field: "amount", width: "basis-1/6", align: "right" },
        ]}
      />
    </Document>
  );
}
