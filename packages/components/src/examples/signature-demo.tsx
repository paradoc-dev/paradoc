/** @jsxRuntime classic */
import React from "react";

/**
 * Demo composition for the `/components/signature` docs page.
 *
 * Mirrors the "Acceptance" section of this package's own
 * `PurchaseOrderDocument` composition (see `purchase-order-document.tsx`):
 * one party's signing block, bound to the services proposal's `provider`
 * party. This is what the docs page's live Preview renders, and its raw
 * source is what the Composition section shows.
 */

import { Document } from "../components/document";
import { Signature } from "../components/signature";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function SignatureDemo() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="signature-demo">
      <Signature party="provider" />
    </Document>
  );
}
