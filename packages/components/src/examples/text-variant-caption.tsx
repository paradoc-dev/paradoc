/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/text` docs page's "Caption" variant: `role="caption"` is
 * the note beside or beneath something, set smaller and italic.
 */

import { Document } from "../components/document";
import { Text } from "../components/text";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function TextVariantCaption() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="text-variant-caption">
      <Text keepId="text-variant-caption" role="caption">
        Prices exclude freight and are held for thirty days.
      </Text>
    </Document>
  );
}
