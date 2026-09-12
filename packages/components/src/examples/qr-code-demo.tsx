/** @jsxRuntime classic */
import React from "react";

/**
 * Demo composition for the `/components/qr-code` docs page.
 *
 * `QRCode` reads no artifact field itself — it takes a URL directly — so this
 * links to the services proposal's own shareable copy, keyed by the same
 * sample's `proposalNumber`. This is what the docs page's live Preview
 * renders, and its raw source is what the Composition section shows.
 */

import { QRCode } from "../components/qr-code";
import { shortProposalData } from "./proposal-data";

export function QRCodeDemo() {
  return (
    <QRCode url={`https://docs.paradoc.dev/p/${String(shortProposalData.fields.proposalNumber)}`} />
  );
}
