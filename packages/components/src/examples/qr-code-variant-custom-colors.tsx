/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/qr-code` docs page's "Custom colors" variant: `color` and
 * `backgroundColor` replace the default black-on-white modules.
 */

import { QRCode } from "../components/qr-code";
import { shortProposalData } from "./proposal-data";

export function QRCodeVariantCustomColors() {
  return (
    <QRCode
      url={`https://docs.paradoc.dev/p/${String(shortProposalData.fields.proposalNumber)}`}
      color="#1d4ed8"
      backgroundColor="#eff6ff"
    />
  );
}
