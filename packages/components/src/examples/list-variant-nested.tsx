/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/list` docs page's "Nested" variant: an item's own `items`
 * are a level of their own, marked `nestedMarker` and prefixed with the
 * parent's marker, so the second sub-item of clause 2 reads `2.b.`.
 */

import { Document } from "../components/document";
import { List } from "../components/list";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function ListVariantNested() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="list-variant-nested">
      <List
        id="clauses"
        items={[
          { text: "The provider performs the services described above." },
          {
            text: "The customer provides, at its own cost:",
            items: [
              { text: "Access to the site during the hours named in the schedule." },
              { text: "Power and network drops at each equipment position." },
              { text: "A named contact who can accept the acceptance tests." },
            ],
          },
          { text: "Either party may terminate on thirty days' written notice." },
        ]}
      />
    </Document>
  );
}
