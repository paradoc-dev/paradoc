/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/page-break` docs page's "Inside a table's rows" variant:
 * the break separates two of a hand-built table's rows, naming the same
 * `table` id a row would, so the header still repeats on the page it opens.
 * `Table`'s own rows come from its bound list and cannot be interrupted this
 * way, so this composition builds the rows directly with `KeepTogether`, the
 * way `Table` itself does.
 */

import { useList } from "@paradoc/react";
import { Document } from "../components/document";
import { KeepTogether } from "../components/keep-together";
import { PageBreak } from "../components/page-break";
import { Pages } from "../components/pages";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

const TABLE_ID = "page-break-variant-inside-a-tables-rows";

function PricedRows() {
  const list = useList("lineItems");
  return (
    <>
      <KeepTogether
        keepId={`${TABLE_ID}:header`}
        data-table-header={TABLE_ID}
        className="flex gap-4 border-b border-neutral-800 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-700"
      >
        <span className="basis-3/4 text-left">Description</span>
        <span className="basis-1/4 text-right">Qty</span>
      </KeepTogether>
      {list.rows.map((_row, index) => (
        <React.Fragment key={index}>
          {index === 2 ? <PageBreak keepId={`${TABLE_ID}:break`} table={TABLE_ID} /> : null}
          <KeepTogether
            keepId={`${TABLE_ID}:${index}`}
            data-table-row={TABLE_ID}
            className="flex gap-4 border-b border-neutral-200 py-1.5"
          >
            <span className="basis-3/4 text-left">{list.text(index, "description")}</span>
            <span className="basis-1/4 text-right">{list.text(index, "quantity")}</span>
          </KeepTogether>
        </React.Fragment>
      ))}
    </>
  );
}

export function PageBreakVariantInsideATablesRows() {
  return (
    <Pages>
      <Document artifact={proposalForm} data={shortProposalData} id="page-break-variant-inside-a-tables-rows">
        <PricedRows />
      </Document>
    </Pages>
  );
}
