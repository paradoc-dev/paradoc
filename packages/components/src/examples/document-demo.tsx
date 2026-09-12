/** @jsxRuntime classic */
import React from "react";

/**
 * Demo composition for the `/components/document` docs page.
 *
 * A `Document` binding the services-proposal sample artifact and data to a
 * top-level `Field` and a titled `Section`, so the Preview shows a `Document`
 * providing context to more than one kind of child at once. This is what the
 * docs page's live Preview renders, and its raw source is what the
 * Composition section shows.
 */

import { Document } from "../components/document";
import { Field } from "../components/field";
import { Section } from "../components/section";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function DocumentDemo() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="document-demo">
      <Field path="proposalNumber" />
      <Section id="customer" title="Prepared for" className="flex flex-col gap-1">
        <Field path="customer" label={false} className="text-sm font-medium text-neutral-900" />
        <Field path="customerAddress" label={false} className="text-sm text-neutral-600" />
      </Section>
    </Document>
  );
}
