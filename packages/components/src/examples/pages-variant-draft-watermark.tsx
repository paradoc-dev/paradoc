/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/pages` docs page's "Draft watermark" variant: a `stamp`
 * that says DRAFT across every sheet, large, light, and turned to rise from
 * the bottom left. The stamp is centred on the sheet behind the content and
 * takes no room in the margin, so the page count is the one the same document
 * has without it.
 */

import { Document } from "../components/document";
import { Pages } from "../components/pages";
import { Section } from "../components/section";
import { Table } from "../components/table";
import { proposalForm } from "./proposal";
import { overflowProposalData } from "./proposal-data";

export function PagesVariantDraftWatermark() {
  return (
    <Pages
      furniture={{
        stamp: <span className="-rotate-45 text-9xl font-bold text-neutral-200">DRAFT</span>,
      }}
    >
      <Document artifact={proposalForm} data={overflowProposalData} id="pages-variant-draft-watermark">
        <Section id="line-items" title="Scope and pricing" className="flex flex-col gap-3">
          <Table
            path="lineItems"
            id="line-items"
            columns={[
              { field: "description", width: "basis-1/2" },
              { field: "amount", width: "basis-1/6", align: "right" },
            ]}
          />
        </Section>
      </Document>
    </Pages>
  );
}
