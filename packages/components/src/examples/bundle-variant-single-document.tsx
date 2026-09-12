/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/bundle` docs page's "Single document" variant: a `Bundle`
 * wrapping just one `Document`, the shape most compositions take (see
 * `proposal-document.tsx`, which is a `Bundle` around one `Document`).
 */

import { Bundle } from "../components/bundle";
import { Document } from "../components/document";
import { Field } from "../components/field";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function BundleVariantSingleDocument() {
  return (
    <Bundle id="bundle-variant-single-document">
      <Document artifact={proposalForm} data={shortProposalData} id="bundle-variant-single-document-doc">
        <Field path="customer" />
      </Document>
    </Bundle>
  );
}
