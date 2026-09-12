/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/table` docs page's "Left-aligned" variant: every column
 * left-aligned instead of the default's right-aligned numeric ones.
 */

import { Document } from "../components/document";
import { Table } from "../components/table";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function TableVariantLeftAligned() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="table-variant-left-aligned">
      <Table
        path="lineItems"
        id="table-variant-left-aligned"
        columns={[
          { field: "description", align: "left" },
          { field: "quantity", header: "Qty", align: "left" },
          { field: "unitPrice", header: "Rate", align: "left" },
        ]}
      />
    </Document>
  );
}
