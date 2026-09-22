/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/table` docs page's "Cell renderer" variant: a column's
 * `render` replaces its cell's plain text with markup built from the
 * formatted text and the row, while the row still paginates as one unit.
 */

import { Document } from "../components/document";
import { Table } from "../components/table";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function TableVariantCellRenderer() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="table-variant-cell-renderer">
      <Table
        path="lineItems"
        id="table-variant-cell-renderer"
        columns={[
          { field: "description" },
          {
            field: "quantity",
            header: "Qty",
            align: "right",
            render: (text) => (
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700">{text}</span>
            ),
          },
          { field: "amount", align: "right" },
        ]}
      />
    </Document>
  );
}
