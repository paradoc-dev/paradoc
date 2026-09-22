/**
 * The invoice, composed from the components.
 *
 * One tree, built only from `Document`, `Section`, `Text`, `Party`, `Field`,
 * `Image`, `Table` and `Totals`, that carries no copy of any label, format, or
 * total and sizes none of its own text. It is the same tree the preview
 * paginates and the PDF renders; `invoiceFurniture` numbers its pages in both.
 *
 * **The parties are `Party` blocks, and what a party record does not carry
 * sits beside them.** The issuer and the customer are the artifact's parties,
 * so each is named by its own block. Their addresses and the customer's
 * accounts contact are fields: the party schema models the party itself, not
 * where it is or who in it the invoice is addressed to, so those stay `Field`s
 * beside the block rather than members of the record.
 *
 * **There is no `Signature`.** An invoice is a demand for payment rather than
 * an agreement, so the artifact declares no signature slot and the composition
 * draws no signing block. What the document ends on is the terms.
 *
 * **The branding is a token set, not markup.** The accent reaches the section
 * headings and the emphasised total through `Document`; the mark is read from
 * the same tokens rather than from a prop, so a tenant who passes their own set
 * replaces both at once. Bytes resolve to a `data:` URI, so neither the browser
 * nor the engine fetches anything and the composition needs no image wiring.
 *
 * Like the purchase order, this composition does not wrap itself in a `Bundle`:
 * it renders bare so a caller who puts it inside a packet supplies the bundle.
 */
/** @jsxRuntime classic */
import React from "react";
import type { Form } from "@paradoc/types";

import { Document } from "../components/document";
import type { DocumentData } from "@paradoc/react";
import { Field } from "../components/field";
import { Image } from "../components/image";
import { PageNumber } from "../components/page-number";
import { Party } from "../components/party";
import { Section } from "../components/section";
import { Table } from "../components/table";
import { Text } from "../components/text";
import { markDocumentRoot, useDocumentTokens } from "@paradoc/react";
import type { PageFurniture } from "@paradoc/react";
import { Totals } from "../components/totals";
import type { FormatOptions } from "@paradoc/react";
import type { DocumentTokensInput } from "@paradoc/react";
import { invoiceForm, invoiceTokens } from "./invoice";

/** Rendered size of the issuer's mark, in CSS pixels. The engine needs both stated. */
const MARK_SIZE_PX = 40;

/**
 * The masthead's organization mark.
 *
 * It is a component of its own so it can read the document's tokens: a hook
 * called in `InvoiceDocument`'s own body would sit above the `Document` that
 * supplies them and would see the package's defaults instead. A tenant who
 * passes no `logo` gets a masthead with no mark rather than someone else's.
 */
function IssuerMark() {
  const { logo } = useDocumentTokens();
  if (logo === undefined) return null;

  return (
    // Decorative: the issuer is named beside it. The mark sits in the row
    // rather than above it so it costs the page no height.
    <Image
      keepId="logo"
      src={logo}
      alt=""
      width={MARK_SIZE_PX}
      height={MARK_SIZE_PX}
      className="h-10 w-10"
    />
  );
}

/**
 * The invoice's page furniture: the page number and the count, in the footer.
 *
 * Hand the same object to `<Pages furniture>` and to `renderPdf`, so the
 * preview and the PDF number the same pages. It is drawn inside the margin, so
 * the page plan and the page count are what they are without it.
 */
export const invoiceFurniture: PageFurniture = { footer: <PageNumber /> };

export interface InvoiceDocumentProps {
  /** The invoice data to render. */
  data: DocumentData;
  /** Overrides the artifact, for tests that vary it. */
  artifact?: Form;
  /** How values the serializer registry does not cover are formatted, and which registry (US or EU) covers the rest. */
  format?: FormatOptions;
  /** Tenant branding. Defaults to the issuer's own accent and mark. */
  tokens?: DocumentTokensInput;
  /** Application-owned classes applied to the document root. */
  className?: string;
}

/**
 * The composition's content, below the `Document` that supplies its tokens: the
 * mark reads them, and a hook above the `Document` would see the package's
 * defaults. Nothing here sizes its own text: the title is a `Text` heading, the
 * parties are `Party` blocks, and every value inherits the document's body
 * size, so the whole invoice follows `typography`.
 */
function InvoiceBody({ artifact }: { artifact: Form }) {
  return (
    <>

      <Section id="masthead" className="flex flex-row justify-between gap-8 border-b border-neutral-800 pb-4">
        <div className="flex basis-1/2 flex-row gap-3">
          <IssuerMark />
          <div className="flex flex-col gap-1">
            <Text keepId="title" role="heading" as="span">
              {artifact.title}
            </Text>
            <Party role="issuer" label={false} />
            <Field path="issuerEmail" label={false} />
          </div>
        </div>
        <div className="flex basis-1/3 flex-col gap-2">
          <Field path="invoiceNumber" />
          <Field path="issuedOn" />
          <Field path="dueOn" />
          <Field path="currency" />
        </div>
      </Section>

      <Section id="parties" title="Addresses">
        <div className="flex flex-row gap-10">
          <div className="flex basis-1/2 flex-col gap-2">
            <Field path="issuerAddress" label="From" />
            <Field path="purchaseOrderNumber" />
          </div>
          {/* The customer is a party, named from its own record. Its accounts
              contact and its address are not members of that record, so they
              are fields beside it. */}
          <div className="flex basis-1/2 flex-col gap-1">
            <Party role="customer" className="flex flex-col gap-0.5 font-medium" />
            <Field path="customerContact" label={false} />
            <Field path="customerAddress" label={false} />
          </div>
        </div>
      </Section>

      <Section id="line-items" title="Billed items" className="flex flex-col gap-3">
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

      <Section id="terms" title="Payment" className="flex flex-col gap-2">
        <Field path="paymentTerms" label={false} />
        <Field path="notes" label={false} />
      </Section>
    </>
  );
}

/**
 * The composed invoice.
 *
 * Exported by name and as the module's default. The default is what a React
 * layer binds to when the renderer imports the module the layer's path names,
 * which is the convention a composition module follows.
 */
export function InvoiceDocument({
  data,
  artifact = invoiceForm,
  format,
  tokens = invoiceTokens,
  className,
}: InvoiceDocumentProps) {
  return (
    <Document artifact={artifact} data={data} format={format} tokens={tokens} id="invoice" className={className}>
      <InvoiceBody artifact={artifact} />
    </Document>
  );
}

markDocumentRoot(InvoiceDocument);
export default InvoiceDocument;
