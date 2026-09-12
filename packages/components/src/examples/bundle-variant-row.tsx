/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/bundle` docs page's "Row layout" variant: a custom
 * `className` replaces the default column stack with a row.
 */

import { Bundle } from "../components/bundle";
import { Document } from "../components/document";
import { Field } from "../components/field";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function BundleVariantRow() {
  return (
    <Bundle id="bundle-variant-row" className="flex flex-row gap-8">
      <Document artifact={proposalForm} data={shortProposalData} id="bundle-variant-row-provider">
        <Field path="provider" />
      </Document>
      <Document artifact={proposalForm} data={shortProposalData} id="bundle-variant-row-customer">
        <Field path="customer" />
      </Document>
    </Bundle>
  );
}
