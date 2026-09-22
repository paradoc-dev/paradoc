/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/list` docs page's "Unordered" variant: `marker="bullet"`
 * marks every item with the same character and numbers nothing.
 */

import { Document } from "../components/document";
import { List } from "../components/list";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function ListVariantUnordered() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="list-variant-unordered">
      <List
        id="deliverables"
        marker="bullet"
        items={[
          { text: "A site survey and the as-built drawings that follow it." },
          { text: "Commissioning against the agreed acceptance tests." },
          { text: "Twelve months of remote support." },
        ]}
      />
    </Document>
  );
}
