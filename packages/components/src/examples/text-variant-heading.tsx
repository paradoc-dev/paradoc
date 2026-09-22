/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/text` docs page's "Heading" variant: `role="heading"` is
 * the largest role, rendered as an `h2` unless `as` says otherwise.
 */

import { Document } from "../components/document";
import { Text } from "../components/text";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function TextVariantHeading() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="text-variant-heading">
      <Text keepId="text-variant-heading" role="heading">
        {proposalForm.title}
      </Text>
    </Document>
  );
}
