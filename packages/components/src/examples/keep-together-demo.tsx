/** @jsxRuntime classic */
import React from "react";

/**
 * Demo composition for the `/components/keep-together` docs page.
 *
 * Mirrors the masthead title in this package's own `ProposalDocument` (see
 * `proposal-document.tsx`): a `KeepTogether` rendered `as="span"`, wrapping a
 * short piece of text so it is never split across a page break. This is what
 * the docs page's live Preview renders, and its raw source is what the
 * Composition section shows.
 */

import { Document } from "../components/document";
import { KeepTogether } from "../components/keep-together";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function KeepTogetherDemo() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="keep-together-demo">
      <KeepTogether as="span" keepId="keep-together-demo-title" className="text-lg font-semibold text-neutral-900">
        {proposalForm.title}
      </KeepTogether>
    </Document>
  );
}
