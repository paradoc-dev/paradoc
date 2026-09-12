/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/table` docs page's "Compact" variant: a two-column
 * subset of the same `lineItems` table.
 */

import { Document } from "../components/document";
import { Table } from "../components/table";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function TableVariantCompact() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="table-variant-compact">
      <Table
        path="lineItems"
        id="table-variant-compact"
        columns={[{ field: "description" }, { field: "amount", align: "right" }]}
      />
    </Document>
  );
}
