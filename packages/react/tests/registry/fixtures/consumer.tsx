/**
 * What a consumer writes after installing the registry.
 *
 * The suite copies this into the scratch project and type-checks it there, so
 * every item is imported from where it was installed and used the way it is
 * meant to be used. An unreferenced file would type-check even with a broken
 * import; this one references them all, from the paginated preview down to a
 * signature block.
 *
 * The artifact and its data come from `@paradoc/react/examples` — sample
 * material, and the only thing here that is not the consumer's own code.
 */

import { useRef } from "react";

import { Bundle } from "@/components/paradoc/bundle";
import { Document } from "@/components/paradoc/document";
import { Field } from "@/components/paradoc/field";
import { KeepTogether } from "@/components/paradoc/keep-together";
import { Page, Pages } from "@/components/paradoc/pages";
import { Paper, Sheet, useFitToWidth } from "@/components/paradoc/paper";
import { Section } from "@/components/paradoc/section";
import { Signature } from "@/components/paradoc/signature";
import { Table } from "@/components/paradoc/table";
import { Totals } from "@/components/paradoc/totals";
import { planPages, type DocumentTokensInput, type PagePlan } from "@paradoc/react";
import { proposalForm, shortProposalData } from "@paradoc/react/examples";

/** A tenant's branding, declared at the document root. */
const tokens: DocumentTokensInput = {
  accentColor: "#0f766e",
  fontFamily: "Source Serif 4 Variable",
  pageSize: "a4",
};

/** The composition, paginated. */
export function Proposal({ onPaginate }: { onPaginate?: (plan: PagePlan) => void }) {
  return (
    <Bundle id="proposal-bundle" tokens={tokens}>
      <Document artifact={proposalForm} data={shortProposalData} id="proposal">
        <Pages onPaginate={onPaginate}>
          <Section id="parties" title="Parties" className="flex flex-col gap-2">
            <Field path="customer" />
            <Field path="issuedOn" label="Issued" />
            <Field path="summary" label={false} className="text-sm" />
          </Section>
          <Section id="line-items" title="Scope and pricing">
            <Table
              path="lineItems"
              id="line-items"
              columns={[
                { field: "description", width: "basis-1/2" },
                { field: "quantity", header: "Qty", align: "right" },
                { field: "unitPrice", header: "Unit price", align: "right" },
                { field: "amount", align: "right" },
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
          <Section id="signatures" title="Signatures">
            <KeepTogether keepId="signature-row" className="flex flex-row gap-8">
              <Signature party="provider" />
              <Signature party="customer" />
              <Signature party="customer" type="initials" />
            </KeepTogether>
          </Section>
        </Pages>
      </Document>
    </Bundle>
  );
}

/**
 * The page furniture on its own: a sheet the consumer scales itself, and one
 * page of a plan it built itself.
 */
export function BareSheet({ plan }: { plan: PagePlan }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const fit = useFitToWidth(frameRef, sheetRef);

  return (
    <div ref={frameRef} style={{ height: fit.height }}>
      <Document artifact={proposalForm} data={shortProposalData}>
        <Page plan={plan} index={0}>
          <Field path="customer" />
        </Page>
      </Document>
      <Sheet page={1} ref={sheetRef} style={{ transform: `scale(${fit.scale})` }}>
        <Document artifact={proposalForm} data={shortProposalData}>
          <Field path="customer" />
        </Document>
      </Sheet>
      <Paper>
        <Document artifact={proposalForm} data={shortProposalData}>
          <Field path="customer" />
        </Document>
      </Paper>
    </div>
  );
}

/** An empty plan, so the fixture does not need a browser to build one. */
export const emptyPlan: PagePlan = planPages([], 720);
