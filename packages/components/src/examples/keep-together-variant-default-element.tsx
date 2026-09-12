/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/keep-together` docs page's "Default element" variant: `as`
 * omitted renders a plain `div`, grouping a couple of fields so they are
 * never separated across a page break.
 */

import { Document } from "../components/document";
import { Field } from "../components/field";
import { KeepTogether } from "../components/keep-together";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function KeepTogetherVariantDefaultElement() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="keep-together-variant-default-element">
      <KeepTogether keepId="keep-together-variant-default-element" className="flex flex-col gap-1 rounded border border-neutral-200 p-3">
        <Field path="customer" label={false} className="text-sm font-medium text-neutral-900" />
        <Field path="customerAddress" label={false} className="text-sm text-neutral-600" />
      </KeepTogether>
    </Document>
  );
}
