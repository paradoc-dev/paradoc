/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/document` docs page's "Branded tokens" variant: a
 * `tokens` prop cascades to every component nested inside this `Document` —
 * here, the titled section's heading picks up the accent color.
 */

import { Document } from "../components/document";
import { Field } from "../components/field";
import { Section } from "../components/section";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function DocumentVariantBrandedTokens() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="document-variant-branded-tokens" tokens={{ accentColor: "#b45309" }}>
      <Section id="summary" title="Summary">
        <Field path="summary" label={false} />
      </Section>
    </Document>
  );
}
