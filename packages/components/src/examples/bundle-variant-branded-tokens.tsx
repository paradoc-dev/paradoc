/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/bundle` docs page's "Branded tokens" variant: a `tokens`
 * prop cascades to every `Document` and component nested inside the bundle —
 * here, the titled section's heading picks up the accent color.
 */

import { Bundle } from "../components/bundle";
import { Document } from "../components/document";
import { Field } from "../components/field";
import { Section } from "../components/section";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function BundleVariantBrandedTokens() {
  return (
    <Bundle id="bundle-variant-branded-tokens" tokens={{ accentColor: "#0f766e" }}>
      <Document artifact={proposalForm} data={shortProposalData} id="bundle-variant-branded-tokens-doc">
        <Section id="summary" title="Summary">
          <Field path="summary" label={false} />
        </Section>
      </Document>
    </Bundle>
  );
}
