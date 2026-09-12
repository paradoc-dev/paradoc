/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/keep-together` docs page's "Passthrough attributes"
 * variant: any prop beyond `keepId`, `as`, and `children` is spread onto the
 * rendered element, here an `aria-label`.
 */

import { Document } from "../components/document";
import { Field } from "../components/field";
import { KeepTogether } from "../components/keep-together";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function KeepTogetherVariantPassthroughAttributes() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="keep-together-variant-passthrough-attributes">
      <KeepTogether keepId="keep-together-variant-passthrough-attributes" aria-label="Customer summary" className="flex flex-col gap-1">
        <Field path="customer" label={false} />
      </KeepTogether>
    </Document>
  );
}
