/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/typography` docs page's "Compact" variant: `scale: "compact"`
 * on the same excerpt; labels, headings, and table headers hold at the floor.
 */

import { Document } from "../components/document";
import { Field } from "../components/field";
import { Section } from "../components/section";
import { Table } from "../components/table";
import { Totals } from "../components/totals";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function TypographyVariantCompact() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="typography-variant-compact" tokens={{ typography: { scale: "compact" } }}>
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
