/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/signature` docs page's "Custom id" variant: `id`
 * overrides the default `<type>:<role>` keep id.
 */

import { Document } from "../components/document";
import { Signature } from "../components/signature";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function SignatureVariantCustomId() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="signature-variant-custom-id">
      <Signature party="provider" id="provider-acceptance" />
    </Document>
  );
}
