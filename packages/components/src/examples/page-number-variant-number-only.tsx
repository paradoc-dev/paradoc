/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/page-number` docs page's "Number only" variant: `total`
 * drops the page count, so the foot reads "Page 2" rather than "Page 2 of 4".
 */

import { Document } from "../components/document";
import { PageNumber } from "../components/page-number";
import { Pages } from "../components/pages";
import { Section } from "../components/section";
import { Table } from "../components/table";
import { proposalForm } from "./proposal";
import { overflowProposalData } from "./proposal-data";

export function PageNumberVariantNumberOnly() {
  return (
    <Pages furniture={{ footer: <PageNumber total={false} /> }}>
      <Document artifact={proposalForm} data={overflowProposalData} id="page-number-number-only">
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
    </Pages>
  );
}
