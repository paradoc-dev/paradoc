/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/table` docs page's "Continued" variant: `continuedLabel`
 * marks the repeated header on every page after the first, and only there.
 *
 * Self-wraps in `Pages`, unlike the page's other table variants, because the
 * label has nothing to show on a table that never crosses a page.
 */

import { Document } from "../components/document";
import { Pages } from "../components/pages";
import { Table } from "../components/table";
import { proposalForm } from "./proposal";
import { overflowProposalData } from "./proposal-data";

export function TableVariantContinued() {
  return (
    <Pages>
      <Document artifact={proposalForm} data={overflowProposalData} id="table-variant-continued">
        <Table
          path="lineItems"
          id="table-variant-continued"
          continuedLabel="(continued)"
          columns={[
            { field: "description", width: "basis-1/2" },
            { field: "quantity", header: "Qty", width: "basis-1/12", align: "right" },
            { field: "unitPrice", header: "Unit price", width: "basis-1/6", align: "right" },
            { field: "amount", width: "basis-1/6", align: "right" },
          ]}
        />
      </Document>
    </Pages>
  );
}
