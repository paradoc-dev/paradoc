/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/page-break` docs page's "Before a section" variant: the
 * break sits directly ahead of a titled `Section`, starting it on a fresh
 * page even though it would otherwise fit under the section before it.
 */

import { Document } from "../components/document";
import { Field } from "../components/field";
import { PageBreak } from "../components/page-break";
import { Pages } from "../components/pages";
import { Section } from "../components/section";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function PageBreakVariantBeforeASection() {
  return (
    <Pages>
      <Document artifact={proposalForm} data={shortProposalData} id="page-break-variant-before-a-section">
        <Section id="summary" title="Summary" className="flex flex-col gap-1">
          <Field path="summary" label={false} />
        </Section>
        <PageBreak keepId="page-break-variant-before-a-section-break" />
        <Section id="customer" title="Prepared for" className="flex flex-col gap-1">
          <Field path="customer" label={false} />
          <Field path="customerAddress" label={false} />
        </Section>
      </Document>
    </Pages>
  );
}
