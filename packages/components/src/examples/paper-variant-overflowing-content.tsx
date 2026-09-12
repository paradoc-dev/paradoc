/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/paper` docs page's "Overflowing content" variant: `Paper`
 * never paginates, so content taller than one page — the long proposal
 * sample's line items — simply grows the one sheet past its normal height
 * instead of continuing onto a second sheet the way `Pages` would.
 */

import { Document } from "../components/document";
import { Paper } from "../components/paper";
import { Section } from "../components/section";
import { Table } from "../components/table";
import { proposalForm } from "./proposal";
import { overflowProposalData } from "./proposal-data";

export function PaperVariantOverflowingContent() {
  return (
    <Paper>
      <Document artifact={proposalForm} data={overflowProposalData} id="paper-variant-overflowing-content">
        <Section id="line-items" title="Scope and pricing" className="flex flex-col gap-3">
          <Table
            path="lineItems"
            id="line-items"
            columns={[
              { field: "description", width: "basis-1/2" },
              { field: "amount", width: "basis-1/6", align: "right" },
            ]}
          />
        </Section>
      </Document>
    </Paper>
  );
}
