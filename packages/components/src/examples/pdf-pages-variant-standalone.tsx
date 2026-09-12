/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/pdf-pages` docs page's "Standalone" variant: `PdfPages`
 * on its own, with no `Part` around it — nothing requires one.
 */

import { PdfPages } from "../components/pdf-pages";
import { vendorPacketAnnexBytes } from "./vendor-packet-annex";

export function PdfPagesVariantStandalone() {
  return <PdfPages bytes={vendorPacketAnnexBytes} filename="certificate-of-insurance.pdf" />;
}
