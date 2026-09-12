/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/document` docs page's "Custom format" variant: a `format`
 * prop overrides how the artifact's own serializers print a field type — here,
 * an organization prints only its name instead of the default's fuller detail.
 */

import { createFormatter } from "@paradoc/format";
import { Document } from "../components/document";
import { Field } from "../components/field";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

const nameOnlyFormatter = createFormatter({
  overrides: {
    organization: (value, options, context) => {
      context.delegate(value, options);
      return String(value?.name ?? "");
    },
  },
});

export function DocumentVariantCustomFormat() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="document-variant-custom-format" format={{ formatter: nameOnlyFormatter }}>
      <Field path="provider" />
    </Document>
  );
}
