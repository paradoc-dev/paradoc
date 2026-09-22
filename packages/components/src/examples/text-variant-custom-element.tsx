/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/text` docs page's "Custom element" variant: `as` renders a
 * role as a different element — a heading as an `h1` where the document's own
 * outline calls for one — without changing the role's size or leading.
 */

import { Document } from "../components/document";
import { Text } from "../components/text";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function TextVariantCustomElement() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="text-variant-custom-element">
      <Text keepId="text-variant-custom-element" role="heading" as="h1">
        {proposalForm.title}
      </Text>
    </Document>
  );
}
