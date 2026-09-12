/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/pages` docs page's "Custom frame" variant: a custom
 * `className` replaces the default scroll frame's background and padding.
 */

import { Document } from "../components/document";
import { Field } from "../components/field";
import { Pages } from "../components/pages";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function PagesVariantCustomFrame() {
  return (
    <Pages className="w-full overflow-hidden bg-neutral-100 p-10">
      <Document artifact={proposalForm} data={shortProposalData} id="pages-variant-custom-frame">
        <Field path="provider" />
      </Document>
    </Pages>
  );
}
