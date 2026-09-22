/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/list` docs page's "Roman" variant: `marker="roman"` marks
 * the items `i.`, `ii.`, `iii.`, the way a recitals block is numbered.
 */

import { Document } from "../components/document";
import { List } from "../components/list";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function ListVariantRoman() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="list-variant-roman">
      <List
        id="recitals"
        marker="roman"
        items={[{ text: "The provider supplies equipment." }, { text: "The customer procures it." }]}
      />
    </Document>
  );
}
