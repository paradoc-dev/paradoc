/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/field` docs page's "No label" variant: `label={false}`
 * renders the value alone, with no heading above it.
 */

import { Document } from "../components/document";
import { Field } from "../components/field";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function FieldVariantNoLabel() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="field-variant-no-label">
      <Field path="customer" label={false} />
    </Document>
  );
}
