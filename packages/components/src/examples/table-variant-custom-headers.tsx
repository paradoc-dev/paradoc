/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/table` docs page's "Custom headers" variant: `header`
 * overrides the artifact's own field labels.
 */

import { Document } from "../components/document";
import { Table } from "../components/table";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function TableVariantCustomHeaders() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="table-variant-custom-headers">
      <Table
        path="lineItems"
        id="table-variant-custom-headers"
        columns={[
          { field: "description", header: "Item" },
          { field: "amount", header: "Total", align: "right" },
        ]}
      />
    </Document>
  );
}
