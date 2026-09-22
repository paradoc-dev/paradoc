/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/field` docs page's "Fill line" variant: a document printed
 * before it is filled. `rule` draws the line a person writes on in place of the
 * blank placeholder, so the two unanswered fields here print a rule while the
 * answered one prints its value.
 */

import { Document } from "../components/document";
import { Field } from "../components/field";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

/** The sample with the two fields a countersigning customer fills in by hand taken back out. */
const data = {
  ...shortProposalData,
  fields: { ...shortProposalData.fields, customerContact: undefined, validUntil: undefined },
};

export function FieldVariantRule() {
  return (
    <Document artifact={proposalForm} data={data} format={{ partial: true }} id="field-variant-rule">
      <div className="flex flex-col gap-4">
        <Field path="customer" />
        <Field path="customerContact" rule />
        <Field path="validUntil" rule />
      </div>
    </Document>
  );
}
