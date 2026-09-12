/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/paper` docs page's "Custom frame" variant: a custom
 * `className` replaces the default frame's background and padding.
 */

import { Document } from "../components/document";
import { Field } from "../components/field";
import { Paper } from "../components/paper";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function PaperVariantCustomFrame() {
  return (
    <Paper className="w-full overflow-hidden bg-neutral-100 p-10">
      <Document artifact={proposalForm} data={shortProposalData} id="paper-variant-custom-frame">
        <Field path="provider" />
      </Document>
    </Paper>
  );
}
