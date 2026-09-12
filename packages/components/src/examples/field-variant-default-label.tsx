/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/field` docs page's "Default label" variant: no `label`
 * prop, so the heading comes from the artifact's own field definition.
 */

import { Document } from "../components/document";
import { Field } from "../components/field";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function FieldVariantDefaultLabel() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="field-variant-default-label">
      <Field path="customer" />
    </Document>
  );
}
