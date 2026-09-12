/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/qr-code` docs page's "Larger size" variant: `size`
 * replaces the default 128px modules.
 */

import { QRCode } from "../components/qr-code";
import { shortProposalData } from "./proposal-data";

export function QRCodeVariantLargerSize() {
  return (
    <QRCode
      url={`https://docs.paradoc.dev/p/${String(shortProposalData.fields.proposalNumber)}`}
      size={200}
    />
  );
}
