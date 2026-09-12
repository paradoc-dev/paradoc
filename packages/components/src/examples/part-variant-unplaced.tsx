/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/part` docs page's "Unplaced" variant: no `firstPage` or
 * `pageCount`, the state before the packet has ever been sealed.
 */

import { Document } from "../components/document";
import { Field } from "../components/field";
import { Part } from "../components/part";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function PartVariantUnplaced() {
  return (
    <Part id="part-variant-unplaced" kind="composition" label="Cover note · composed live">
      <Document artifact={proposalForm} data={shortProposalData} id="part-variant-unplaced-doc">
        <Field path="customer" />
      </Document>
    </Part>
  );
}
