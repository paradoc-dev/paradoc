/** @jsxRuntime classic */
import React from "react";

/**
 * Demo composition for the `/components/paper` docs page.
 *
 * `Paper` draws one sheet at the document's page geometry and scales it to
 * fit its frame — no pagination, unlike `Pages`. This is what the docs
 * page's live Preview renders, and its raw source is what the Composition
 * section shows.
 */

import { Document } from "../components/document";
import { Field } from "../components/field";
import { Paper } from "../components/paper";
import { Section } from "../components/section";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function PaperDemo() {
  return (
    <Paper>
      <Document artifact={proposalForm} data={shortProposalData} id="paper-demo">
        <Section id="customer" title="Prepared for" className="flex flex-col gap-1">
          <Field path="customer" label={false} />
          <Field path="customerAddress" label={false} />
        </Section>
      </Document>
    </Paper>
  );
}
