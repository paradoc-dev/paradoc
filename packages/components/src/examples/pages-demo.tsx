/** @jsxRuntime classic */
import React from "react";

/**
 * Demo composition for the `/components/pages` docs page.
 *
 * `Pages` measures the services-proposal sample once and lays it out as
 * paginated sheets — one sheet here, since the content is short. This is
 * what the docs page's live Preview renders, and its raw source is what the
 * Composition section shows.
 */

import { Document } from "../components/document";
import { Field } from "../components/field";
import { Pages } from "../components/pages";
import { Section } from "../components/section";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function PagesDemo() {
  return (
    <Pages>
      <Document artifact={proposalForm} data={shortProposalData} id="pages-demo">
        <Section id="customer" title="Prepared for" className="flex flex-col gap-1">
          <Field path="customer" label={false} />
          <Field path="customerAddress" label={false} />
        </Section>
      </Document>
    </Pages>
  );
}
