/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/typography` docs page's "Roomy" variant: `scale: "roomy"` on
 * the same excerpt, every role one size up with looser leading.
 */

import { Document } from "../components/document";
import { Field } from "../components/field";
import { Section } from "../components/section";
import { Table } from "../components/table";
import { Totals } from "../components/totals";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function TypographyVariantRoomy() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="typography-variant-roomy" tokens={{ typography: { scale: "roomy" } }}>
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
