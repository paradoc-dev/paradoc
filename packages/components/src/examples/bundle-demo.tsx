/** @jsxRuntime classic */
import React from "react";

/**
 * Demo composition for the `/components/bundle` docs page.
 *
 * Two `Document`s of the services-proposal sample, grouped under one
 * `Bundle` — the shape a packet of related documents takes. This is what
 * the docs page's live Preview renders, and its raw source is what the
 * Composition section shows.
 */

import { Bundle } from "../components/bundle";
import { Document } from "../components/document";
import { Field } from "../components/field";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function BundleDemo() {
  return (
    <Bundle id="bundle-demo">
      <Document artifact={proposalForm} data={shortProposalData} id="bundle-demo-cover">
        <Field path="provider" />
      </Document>
      <Document artifact={proposalForm} data={shortProposalData} id="bundle-demo-terms">
        <Field path="terms" label={false} />
      </Document>
    </Bundle>
  );
}
