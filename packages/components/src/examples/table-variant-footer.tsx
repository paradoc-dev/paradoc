/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/table` docs page's "Footer" variant: `footer` evaluates
 * rows from the artifact's own definitions and never opens a page without the
 * table's last row, the way `Totals` prints the same subtotal and total elsewhere.
 */

import { Document } from "../components/document";
import { Table } from "../components/table";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function TableVariantFooter() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="table-variant-footer">
      <Table
        path="lineItems"
        id="table-variant-footer"
        columns={[{ field: "description" }, { field: "amount", align: "right" }]}
        footer={[{ def: "subtotal" }, { def: "total", emphasis: true }]}
      />
    </Document>
  );
}
