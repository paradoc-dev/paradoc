/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/paper` docs page's "Minimal content" variant: `Paper`
 * draws whatever it is given, with no `Section` or layout required around it.
 */

import { Document } from "../components/document";
import { Field } from "../components/field";
import { Paper } from "../components/paper";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function PaperVariantMinimalContent() {
  return (
    <Paper>
      <Document artifact={proposalForm} data={shortProposalData} id="paper-variant-minimal-content">
        <Field path="provider" />
      </Document>
    </Paper>
  );
}
