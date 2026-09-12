/** @jsxRuntime classic */
import React from "react";

/**
 * Demo composition for the `/components/part` docs page.
 *
 * A small two-document packet, in the spirit of this package's own
 * `VendorPacketDocument` (see `vendor-packet-document.tsx`): a composed cover
 * note and the vendor packet's own certificate-of-insurance annex, painted by
 * `PdfPages`. Both `Part`s carry a sealed placement, so each shows the packet
 * pages it occupies. This is what the docs page's live Preview renders, and
 * its raw source is what the Composition section shows.
 */

import { Bundle } from "../components/bundle";
import { Document } from "../components/document";
import { Field } from "../components/field";
import { Part } from "../components/part";
import { PdfPages } from "../components/pdf-pages";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";
import { vendorPacketAnnexBytes } from "./vendor-packet-annex";

/** The packet these two parts were sealed together as. */
const PACKET_HASH = "part-demo-packet";

export function PartDemo() {
  return (
    <Bundle id="part-demo" className="flex flex-col gap-8">
      <Part
        id="cover-note"
        kind="composition"
        label="Cover note · composed live"
        firstPage={1}
        pageCount={1}
        placedFor={PACKET_HASH}
        packetHash={PACKET_HASH}
      >
        <Document artifact={proposalForm} data={shortProposalData} id="part-demo-cover-note">
          <Field path="customer" />
        </Document>
      </Part>
      <Part
        id="insurance-annex"
        kind="annex"
        label="Certificate of insurance · annex"
        firstPage={2}
        pageCount={1}
        placedFor={PACKET_HASH}
        packetHash={PACKET_HASH}
      >
        <PdfPages bytes={vendorPacketAnnexBytes} filename="certificate-of-insurance.pdf" />
      </Part>
    </Bundle>
  );
}
