/**
 * The purchase order, composed from the components.
 *
 * One tree, built only from `Document`, `Section`, `Text`, `Field`, `Table`,
 * `Totals`, and `Signature`, that carries no copy of any label, format, or
 * total and sizes none of its own text. It is the same tree the preview
 * paginates and the PDF renders; `purchaseOrderFurniture` numbers its pages in
 * both.
 *
 * The buyer and the supplier are printed from the artifact's own `buyer` and
 * `supplier` fields rather than through `Party`. A session fills this order,
 * and a document mid-session has parties nobody has answered yet: `Field`
 * prints the blank placeholder for those, where `Party` fails on a role with
 * no party filled.
 *
 * Unlike the proposal, this composition does not wrap itself in a `Bundle`.
 * It is used both on its own and as one part of a larger packet, and a
 * packet's own layer supplies the bundle around every composition it
 * contains, so this one renders bare and lets the caller decide.
 */
/** @jsxRuntime classic */
import React from "react";
import type { Form } from "@paradoc/types";

import { Document } from "../components/document";
import { markDocumentRoot, type PageFurniture } from "@paradoc/react";
import type { FormatOptions } from "@paradoc/react";
import type { DocumentData } from "@paradoc/react";
import { Field } from "../components/field";
import { PageNumber } from "../components/page-number";
import { Section } from "../components/section";
import { Signature } from "../components/signature";
import { Table } from "../components/table";
import { Text } from "../components/text";
import { Totals } from "../components/totals";
import type { DocumentTokensInput } from "@paradoc/react";
import { purchaseOrderForm } from "./purchase-order";

/**
 * The order's page furniture: the page number and the count, in the footer.
 *
 * Hand the same object to `<Pages furniture>` and to `renderPdf`, so the
 * preview and the PDF number the same pages. It is drawn inside the margin, so
 * the page plan and the page count are what they are without it.
 */
export const purchaseOrderFurniture: PageFurniture = { footer: <PageNumber /> };

export interface PurchaseOrderDocumentProps {
  /** The purchase order data to render. */
  data: DocumentData;
  /** Overrides the artifact, for tests that vary it. */
  artifact?: Form;
  /** How values the serializer registry does not cover are formatted, and which registry (US or EU) covers the rest. */
  format?: FormatOptions;
  /** Tenant branding. See `src/examples/tokens.ts` for the sample's second set. */
  tokens?: DocumentTokensInput;
}

/**
 * The composition's content. Nothing here sizes its own text: the title is a
 * `Text` heading and every value inherits the document's body size, so the
 * whole order follows `typography`.
 */
function PurchaseOrderBody({ artifact }: { artifact: Form }) {
  return (
    <>

      <Section id="masthead" className="flex flex-row justify-between gap-8 border-b border-neutral-800 pb-4">
        <div className="flex basis-1/2 flex-col gap-1">
          <Text keepId="title" role="heading" as="span">
            {artifact.title}
          </Text>
          <Field path="buyer" label={false} />
          <Field path="buyerAddress" label={false} />
        </div>
        <div className="flex basis-1/3 flex-col gap-2">
          <Field path="orderNumber" />
          <Field path="issuedOn" />
          <Field path="deliverBy" />
          <Field path="currency" />
        </div>
      </Section>

      <Section id="supplier" title="Supplier" className="flex flex-col gap-1">
        <Field path="supplier" label={false} className="font-medium" />
        <Field path="supplierContact" label={false} />
        <Field path="supplierAddress" label={false} />
      </Section>

      <Section id="ship-to" title="Ship to" className="flex flex-col gap-1">
        <Field path="shipTo" label={false} />
      </Section>

      <Section id="line-items" title="Ordered items" className="flex flex-col gap-3">
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
        <Field path="terms" label={false} />
      </Section>

      <Section id="acceptance" title="Acceptance" className="flex flex-col gap-4 pt-4">
        <div className="flex flex-row gap-10">
          <Signature party="buyer" className="flex basis-1/2 flex-col gap-1" />
          <Signature party="supplier" className="flex basis-1/2 flex-col gap-1" />
        </div>
      </Section>
    </>
  );
}

/**
 * The composed purchase order.
 *
 * Exported by name and as the module's default. The default is what a React
 * layer binds to when the renderer imports the module the layer's path names,
 * which is the convention a composition module follows.
 */
export function PurchaseOrderDocument({
  data,
  artifact = purchaseOrderForm,
  format,
  tokens,
}: PurchaseOrderDocumentProps) {
  return (
    <Document artifact={artifact} data={data} format={format} tokens={tokens} id="purchase-order">
      <PurchaseOrderBody artifact={artifact} />
    </Document>
  );
}

markDocumentRoot(PurchaseOrderDocument);
export default PurchaseOrderDocument;
