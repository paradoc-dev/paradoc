/** @jsxRuntime classic */
import React from "react";

/**
 * Demo composition for the `/components/list` docs page.
 *
 * The exclusions a services proposal carries, as a numbered list. Each item is
 * its own pagination unit, and the markers are the text you see rather than a
 * marker the renderer draws. This is what the docs page's live Preview
 * renders, and its raw source is what the Composition section shows.
 */

import { Document } from "../components/document";
import { List } from "../components/list";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function ListDemo() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="list-demo">
      <List
        id="exclusions"
        items={[
          { text: "Permits, inspections, and any fees a local authority charges." },
          { text: "Removal or disposal of equipment the site already carries." },
          { text: "Work outside the hours the site access agreement names." },
        ]}
      />
    </Document>
  );
}
