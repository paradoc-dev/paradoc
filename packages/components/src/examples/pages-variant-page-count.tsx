/** @jsxRuntime classic */
import React from "react";
import { useState } from "react";

/**
 * The `/components/pages` docs page's "Page count" variant: `onPaginate` is
 * called with the measured plan whenever pagination changes, here used to
 * show the resulting page count beside the preview.
 */

import { Document } from "../components/document";
import { Field } from "../components/field";
import { Pages } from "../components/pages";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function PagesVariantPageCount() {
  const [pageCount, setPageCount] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-2">
      {pageCount !== null ? (
        <p className="text-xs text-neutral-500">{pageCount} page{pageCount === 1 ? "" : "s"}</p>
      ) : null}
      <Pages onPaginate={(plan) => setPageCount(plan.pages.length)}>
        <Document artifact={proposalForm} data={shortProposalData} id="pages-variant-page-count">
          <Field path="provider" />
        </Document>
      </Pages>
    </div>
  );
}
