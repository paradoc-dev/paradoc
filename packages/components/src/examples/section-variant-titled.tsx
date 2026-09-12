/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/section` docs page's "Titled" variant: the default, with
 * a heading.
 */

import { Document } from "../components/document";
import { Field } from "../components/field";
import { Section } from "../components/section";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function SectionVariantTitled() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="section-variant-titled">
      <Section id="variant-titled" title="Prepared for">
        <Field path="customer" label={false} />
      </Section>
    </Document>
  );
}
