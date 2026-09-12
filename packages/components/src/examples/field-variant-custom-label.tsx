/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/field` docs page's "Custom label" variant: a string
 * `label` overrides the artifact's own.
 */

import { Document } from "../components/document";
import { Field } from "../components/field";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function FieldVariantCustomLabel() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="field-variant-custom-label">
      <Field path="customer" label="Billed to" />
    </Document>
  );
}
