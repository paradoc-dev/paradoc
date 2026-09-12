/** @jsxRuntime classic */
import React from "react";

/**
 * Demo composition for the `/components/field` docs page.
 *
 * A minimal, real composition: the services-proposal sample artifact and
 * data this package's other examples already use, bound to a handful of
 * `Field`s directly inside `Document`, with no `Section` or layout around
 * them. This is what the docs page's live Preview renders, and its raw
 * source is what the Composition section shows.
 */

import { Document } from "../components/document";
import { Field } from "../components/field";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function FieldDemo() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="field-demo">
      <div className="flex flex-col gap-4">
        <Field path="provider" />
        <Field path="customer" />
        <Field path="issuedOn" />
      </div>
    </Document>
  );
}
