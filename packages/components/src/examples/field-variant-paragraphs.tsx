/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/field` docs page's "Paragraphs" variant: a value written
 * with a blank line in it prints as two paragraphs, each its own pagination
 * unit, so prose long enough to pass a page breaks between them instead of
 * overflowing as one oversize keep.
 */

import { Document } from "../components/document";
import { Field } from "../components/field";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

/** The sample's terms, as a filler who pressed return twice would supply them. */
const data = {
  ...shortProposalData,
  fields: {
    ...shortProposalData.fields,
    terms:
      "Payment is due 30 days from invoice. Work begins once both parties sign.\n\nEither party may end the engagement with 14 days written notice; work completed to that date remains payable.",
  },
};

export function FieldVariantParagraphs() {
  return (
    <Document artifact={proposalForm} data={data} id="field-variant-paragraphs">
      <Field path="terms" paragraphs />
    </Document>
  );
}
