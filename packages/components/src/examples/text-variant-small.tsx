/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/text` docs page's "Small" variant: `role="small"` is the
 * fine print a document closes with.
 */

import { Document } from "../components/document";
import { Text } from "../components/text";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function TextVariantSmall() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="text-variant-small">
      <Text keepId="text-variant-small" role="small">
        This proposal is not an offer capable of acceptance until countersigned by both parties.
      </Text>
    </Document>
  );
}
