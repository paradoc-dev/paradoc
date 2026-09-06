/**
 * The proposal, composed from the components.
 *
 * This is the whole point: one tree, built only from `Document`,
 * `Section`, `Field`, `Table`, `Totals`, and `Signature`, that carries no copy
 * of any label, format, or total. It is the same tree the preview paginates and
 * the PDF renders.
 */

import type { Form } from "@paradoc/types";

import { KeepTogether } from "../components/keep-together";
import { Bundle } from "../components/bundle";
import { Document } from "../components/document";
import type { FormatOptions } from "../lib/format";
import type { DocumentData } from "../components/document-context";
import { Field } from "../components/field";
import { Section } from "../components/section";
import { Signature } from "../components/signature";
import { Table } from "../components/table";
import { useDocumentTokens } from "../components/tokens-context";
import { Totals } from "../components/totals";
import type { DocumentTokensInput } from "../lib/tokens";
import { proposalForm } from "./proposal";
import {
  PROPOSAL_LOGO_HEIGHT_PX,
  PROPOSAL_LOGO_SRC,
  PROPOSAL_LOGO_WIDTH_PX,
} from "./logo";

/**
 * The masthead's organization mark.
 *
 * It is a component of its own so it can read the document's tokens: a hook
 * called in `ProposalDocument`'s own body would sit above the `Document` that
 * supplies them and would see the package's defaults instead. The `logo` token
 * wins when the tenant sets one, and the sample's own mark is what a document
 * with no tokens still shows.
 */
function ProposalMark({ fallbackSrc }: { fallbackSrc: string }) {
  const { logo } = useDocumentTokens();

  return (
    // Decorative: the organization is named beside it. The mark sits in the row
    // rather than above it so it costs the page no height.
    <KeepTogether
      as="img"
      keepId="logo"
      src={logo ?? fallbackSrc}
      alt=""
      width={PROPOSAL_LOGO_WIDTH_PX}
      height={PROPOSAL_LOGO_HEIGHT_PX}
      className="h-10 w-10"
    />
  );
}

export interface ProposalDocumentProps {
  /** The proposal data to render. */
  data: DocumentData;
  /** Overrides the artifact, for tests that vary it. */
  artifact?: Form;
  /**
   * Where the organization mark is loaded from. The default is the key the PDF
   * path supplies bytes under; a browser caller passes a URL it can fetch.
   */
  logoSrc?: string;
  /** How values the serializer registry does not cover are formatted, and which registry (US or EU) covers the rest. */
  format?: FormatOptions;
  /** Tenant branding. See `src/examples/tokens.ts` for the sample's second set. */
  tokens?: DocumentTokensInput;
}

/**
 * The composed proposal.
 *
 * Exported by name and as the module's default. The default is what a React
 * layer binds to when the renderer imports the module the layer's path names,
 * which is the convention a composition module follows.
 */
export function ProposalDocument({
  data,
  artifact = proposalForm,
  logoSrc = PROPOSAL_LOGO_SRC,
  format,
  tokens,
}: ProposalDocumentProps) {
  return (
    <Bundle id="proposal-bundle" tokens={tokens}>
      <Document artifact={artifact} data={data} format={format} id="proposal">
        <Section id="masthead" className="flex flex-row justify-between gap-8 border-b border-neutral-800 pb-4">
          <div className="flex basis-1/2 flex-row gap-3">
            <ProposalMark fallbackSrc={logoSrc} />
            <div className="flex flex-col gap-1">
              <KeepTogether as="span" keepId="title" className="text-lg font-semibold text-neutral-900">
                {artifact.title}
              </KeepTogether>
              <Field path="provider" label={false} className="text-sm text-neutral-700" />
              <Field path="providerAddress" label={false} className="text-sm text-neutral-600" />
              <Field path="providerPhone" label={false} className="text-sm text-neutral-600" />
            </div>
          </div>
          <div className="flex basis-1/3 flex-col gap-2">
            <Field path="proposalNumber" />
            <Field path="issuedOn" />
            <Field path="validUntil" />
            <Field path="currency" />
          </div>
        </Section>

        <Section id="customer" title="Prepared for" className="flex flex-col gap-1">
          <Field path="customer" label={false} className="text-sm font-medium text-neutral-900" />
          <Field path="customerContact" label={false} className="text-sm text-neutral-700" />
          <Field path="customerAddress" label={false} className="text-sm text-neutral-600" />
        </Section>

        <Section id="summary" title="Summary">
          <Field path="summary" label={false} className="text-sm leading-relaxed text-neutral-800" />
        </Section>

        <Section id="line-items" title="Scope and pricing" className="flex flex-col gap-3">
          <Table
            path="lineItems"
            id="line-items"
            columns={[
              { field: "description", width: "basis-1/2" },
              { field: "quantity", header: "Qty", width: "basis-1/12", align: "right" },
              { field: "unit", width: "basis-1/12" },
              { field: "unitPrice", header: "Unit price", width: "basis-1/6", align: "right" },
              { field: "amount", width: "basis-1/6", align: "right" },
            ]}
          />
          <Totals
            rows={[
              { def: "subtotal" },
              { def: "tax", ratePath: "taxRatePercent" },
              { def: "total", emphasis: true },
            ]}
          />
        </Section>

        <Section id="terms" title="Terms">
          <Field path="terms" label={false} className="text-sm leading-relaxed text-neutral-800" />
        </Section>

        <Section id="acceptance" title="Acceptance" className="flex flex-col gap-4 pt-4">
          <div className="flex flex-row gap-10">
            <Signature party="provider" className="flex basis-1/2 flex-col gap-1" />
            <Signature party="customer" className="flex basis-1/2 flex-col gap-1" />
          </div>
        </Section>
      </Document>
    </Bundle>
  );
}

export default ProposalDocument;
