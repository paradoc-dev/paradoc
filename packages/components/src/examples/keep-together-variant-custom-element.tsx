/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/keep-together` docs page's "Custom element" variant: `as`
 * renders a semantic element other than `div`, here a `header` laying its
 * two fields out in a row.
 */

import { Document } from "../components/document";
import { Field } from "../components/field";
import { KeepTogether } from "../components/keep-together";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function KeepTogetherVariantCustomElement() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="keep-together-variant-custom-element">
      <KeepTogether as="header" keepId="keep-together-variant-custom-element" className="flex flex-row gap-6">
        <Field path="provider" />
        <Field path="customer" />
      </KeepTogether>
    </Document>
  );
}
