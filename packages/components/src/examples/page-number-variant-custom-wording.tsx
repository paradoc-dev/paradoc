/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/page-number` docs page's "Custom wording" variant: `label`
 * and `separator` replace the default "Page" and "of", so the same two numbers
 * read "Sheet 2 / 4". Both outputs print the words the composition gives.
 */

import { Document } from "../components/document";
import { PageNumber } from "../components/page-number";
import { Pages } from "../components/pages";
import { Section } from "../components/section";
import { Table } from "../components/table";
import { proposalForm } from "./proposal";
import { overflowProposalData } from "./proposal-data";

export function PageNumberVariantCustomWording() {
  return (
    <Pages furniture={{ footer: <PageNumber label="Sheet" separator="/" /> }}>
      <Document artifact={proposalForm} data={overflowProposalData} id="page-number-custom-wording">
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
