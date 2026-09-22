/** @jsxRuntime classic */
import React from "react";

/**
 * Demo composition for the `/components/page-break` docs page.
 *
 * Two `KeepTogether` blocks split by a `PageBreak`: the second block starts
 * on a fresh sheet even though it would otherwise fit under the first. This
 * is what the docs page's live Preview renders, and its raw source is what
 * the Composition section shows.
 */

import { Document } from "../components/document";
import { Field } from "../components/field";
import { KeepTogether } from "../components/keep-together";
import { PageBreak } from "../components/page-break";
import { Pages } from "../components/pages";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function PageBreakDemo() {
  return (
    <Pages>
      <Document artifact={proposalForm} data={shortProposalData} id="page-break-demo">
        <KeepTogether keepId="page-break-demo-first" className="flex flex-col gap-1">
          <Field path="proposalNumber" />
          <Field path="issuedOn" />
        </KeepTogether>
        <PageBreak keepId="page-break-demo-break" />
        <KeepTogether keepId="page-break-demo-second" className="flex flex-col gap-1">
          <Field path="customer" />
          <Field path="customerAddress" />
        </KeepTogether>
      </Document>
    </Pages>
  );
}
