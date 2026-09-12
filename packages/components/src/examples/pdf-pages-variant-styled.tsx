/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/pdf-pages` docs page's "Custom frame" variant: a
 * `className` replaces the default gray frame around the painted pages.
 */

import { PdfPages } from "../components/pdf-pages";
import { vendorPacketAnnexBytes } from "./vendor-packet-annex";

export function PdfPagesVariantStyled() {
  return (
    <PdfPages
      bytes={vendorPacketAnnexBytes}
      filename="certificate-of-insurance.pdf"
      className="w-full overflow-hidden rounded-lg border border-neutral-300 bg-white p-4"
    />
  );
}
