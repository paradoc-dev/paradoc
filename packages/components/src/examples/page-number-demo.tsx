/** @jsxRuntime classic */
import React from "react";

/**
 * Demo composition for the `/components/page-number` docs page.
 *
 * `PageNumber` prints nothing of its own: the numbers come from whatever is
 * drawing the page. So the demo puts it where it belongs — the `footer` slot
 * of the page furniture — over the long proposal sample, whose line items run
 * to several sheets, and each sheet prints its own number. This is what the
 * docs page's live Preview renders, and its raw source is what the
 * Composition section shows.
 */

import { Document } from "../components/document";
import { PageNumber } from "../components/page-number";
import { Pages } from "../components/pages";
import { Section } from "../components/section";
import { Table } from "../components/table";
import { proposalForm } from "./proposal";
import { overflowProposalData } from "./proposal-data";

export function PageNumberDemo() {
  return (
    <Pages furniture={{ footer: <PageNumber /> }}>
      <Document artifact={proposalForm} data={overflowProposalData} id="page-number-demo">
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
