/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/section` docs page's "Untitled" variant: omitting
 * `title` renders no heading at all.
 */

import { Document } from "../components/document";
import { Field } from "../components/field";
import { Section } from "../components/section";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function SectionVariantUntitled() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="section-variant-untitled">
      <Section id="variant-untitled">
        <Field path="customer" label={false} />
      </Section>
    </Document>
  );
}
