/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/document` docs page's "Custom layout" variant: a custom
 * `className` replaces the default column stack with a row.
 */

import { Document } from "../components/document";
import { Field } from "../components/field";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function DocumentVariantCustomLayout() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="document-variant-custom-layout" className="flex flex-row gap-6 text-sm text-neutral-900">
      <Field path="provider" />
      <Field path="customer" />
    </Document>
  );
}
