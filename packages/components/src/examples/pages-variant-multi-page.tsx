/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/pages` docs page's "Multi-page overflow" variant: the
 * long proposal sample's line items run past three pages, so `Pages` lays
 * the same one tree out across several sheets and repeats the table's
 * header on every page it continues onto.
 */

import { Document } from "../components/document";
import { Pages } from "../components/pages";
import { Section } from "../components/section";
import { Table } from "../components/table";
import { proposalForm } from "./proposal";
import { overflowProposalData } from "./proposal-data";

export function PagesVariantMultiPage() {
  return (
    <Pages>
      <Document artifact={proposalForm} data={overflowProposalData} id="pages-variant-multi-page">
        <Section id="line-items" title="Scope and pricing" className="flex flex-col gap-3">
          <Table
            path="lineItems"
            id="line-items"
            columns={[
              { field: "description", width: "basis-1/2" },
              { field: "quantity", header: "Qty", width: "basis-1/12", align: "right" },
              { field: "unitPrice", header: "Unit price", width: "basis-1/6", align: "right" },
              { field: "amount", width: "basis-1/6", align: "right" },
            ]}
          />
        </Section>
      </Document>
    </Pages>
  );
}
