/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/part` docs page's "Placed" variant: `firstPage` and
 * `pageCount` match the packet on screen, so the header names the packet
 * pages this part occupies.
 */

import { Document } from "../components/document";
import { Field } from "../components/field";
import { Part } from "../components/part";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

const PACKET_HASH = "part-variant-placed-packet";

export function PartVariantPlaced() {
  return (
    <Part
      id="part-variant-placed"
      kind="composition"
      label="Cover note · composed live"
      firstPage={3}
      pageCount={2}
      placedFor={PACKET_HASH}
      packetHash={PACKET_HASH}
    >
      <Document artifact={proposalForm} data={shortProposalData} id="part-variant-placed-doc">
        <Field path="customer" />
      </Document>
    </Part>
  );
}
