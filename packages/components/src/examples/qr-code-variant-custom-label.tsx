/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/qr-code` docs page's "Custom label" variant: `label`
 * overrides the default `QR code for <url>` accessible name.
 */

import { QRCode } from "../components/qr-code";
import { shortProposalData } from "./proposal-data";

export function QRCodeVariantCustomLabel() {
  return (
    <QRCode
      url={`https://docs.paradoc.dev/p/${String(shortProposalData.fields.proposalNumber)}`}
      label="Scan for the online copy of this proposal"
    />
  );
}
