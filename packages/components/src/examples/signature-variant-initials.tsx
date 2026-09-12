/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/signature` docs page's "Initials" variant: `type="initials"`
 * draws the shorter initials rule instead of a full signature.
 */

import { Document } from "../components/document";
import { Signature } from "../components/signature";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function SignatureVariantInitials() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="signature-variant-initials">
      <Signature party="provider" type="initials" />
    </Document>
  );
}
