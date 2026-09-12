/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/signature` docs page's "Signature" variant: the default
 * `type`, for the proposal's other party.
 */

import { Document } from "../components/document";
import { Signature } from "../components/signature";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function SignatureVariantSignature() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="signature-variant-signature">
      <Signature party="customer" />
    </Document>
  );
}
