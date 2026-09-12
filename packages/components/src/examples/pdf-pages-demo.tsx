/** @jsxRuntime classic */
import React from "react";

/**
 * Demo composition for the `/components/pdf-pages` docs page.
 *
 * The vendor packet's own certificate-of-insurance annex (see
 * `vendor-packet-document.tsx`), painted inside a single `Part` so the
 * rendered pages read as one document of a packet rather than a floating
 * image. This is what the docs page's live Preview renders, and its raw
 * source is what the Composition section shows.
 */

import { Bundle } from "../components/bundle";
import { Part } from "../components/part";
import { PdfPages } from "../components/pdf-pages";
import { vendorPacketAnnexBytes } from "./vendor-packet-annex";

export function PdfPagesDemo() {
  return (
    <Bundle id="pdf-pages-demo" className="flex flex-col gap-8">
      <Part id="insurance-annex" kind="annex" label="Certificate of insurance · annex">
        <PdfPages bytes={vendorPacketAnnexBytes} filename="certificate-of-insurance.pdf" />
      </Part>
    </Bundle>
  );
}
