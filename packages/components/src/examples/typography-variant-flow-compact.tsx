/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/typography` docs page's "Flow compact" variant: `flow:
 * "compact"` on the same excerpt, the root's blocks closer and no text moved.
 */

import { Document } from "../components/document";
import { Field } from "../components/field";
import { Section } from "../components/section";
import { Table } from "../components/table";
import { Totals } from "../components/totals";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function TypographyVariantFlowCompact() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="typography-variant-flow-compact" tokens={{ typography: { flow: "compact" } }}>
      <Section id="customer" title="Prepared for">
        <Field path="customer" />
        <Field path="issuedOn" />
      </Section>
      <Section id="line-items" title="Scope and pricing">
        <Table
          path="lineItems"
          columns={[
            { field: "description", width: "basis-1/2" },
            { field: "quantity", header: "Qty", width: "basis-1/6", align: "right" },
            { field: "amount", width: "basis-1/3", align: "right" },
          ]}
        />
        <Totals rows={[{ def: "subtotal" }, { def: "total", emphasis: true }]} />
      </Section>
    </Document>
  );
}
