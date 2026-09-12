/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/section` docs page's "Row layout" variant: a custom
 * `className` replaces the default column layout with a row.
 */

import { Document } from "../components/document";
import { Field } from "../components/field";
import { Section } from "../components/section";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function SectionVariantRow() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="section-variant-row">
      <Section id="variant-row" title="Provider" className="flex flex-row items-baseline gap-6">
        <Field path="provider" label={false} />
        <Field path="providerPhone" label={false} />
      </Section>
    </Document>
  );
}
