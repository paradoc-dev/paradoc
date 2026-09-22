/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/pages` docs page's "Page furniture" variant: `furniture`
 * gives every sheet a running head, a numbered foot, and a stamp behind the
 * content. Each band is drawn inside the margin the document already declares,
 * so the page plan and the page count are what they would be without it.
 */

import { Document } from "../components/document";
import { PageNumber } from "../components/page-number";
import { Pages } from "../components/pages";
import { Section } from "../components/section";
import { Table } from "../components/table";
import { proposalForm } from "./proposal";
import { overflowProposalData } from "./proposal-data";

export function PagesVariantPageFurniture() {
  return (
    <Pages
      furniture={{
        header: <span className="text-xs text-neutral-500">Northwind Partners LLP</span>,
        footer: <PageNumber />,
        stamp: <span className="text-6xl font-semibold text-neutral-200">DRAFT</span>,
      }}
    >
      <Document artifact={proposalForm} data={overflowProposalData} id="pages-variant-page-furniture">
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
