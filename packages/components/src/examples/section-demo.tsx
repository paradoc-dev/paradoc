/** @jsxRuntime classic */
import React from "react";

/**
 * Demo composition for the `/components/section` docs page.
 *
 * Mirrors the "Prepared for" section of this package's own `ProposalDocument`
 * composition (see `proposal-document.tsx`): a titled `Section` grouping a
 * few `Field`s. This is what the docs page's live Preview renders, and its
 * raw source is what the Composition section shows.
 */

import { Document } from "../components/document";
import { Field } from "../components/field";
import { Section } from "../components/section";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function SectionDemo() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="section-demo">
      <Section id="customer" title="Prepared for" className="flex flex-col gap-1">
        <Field path="customer" label={false} className="text-sm font-medium text-neutral-900" />
        <Field path="customerContact" label={false} className="text-sm text-neutral-700" />
        <Field path="customerAddress" label={false} className="text-sm text-neutral-600" />
      </Section>
    </Document>
  );
}
