/** @jsxRuntime classic */
import React from "react";
import { createFormatter } from "@paradoc/format";
/**
 * The Arabic letter, composed from the same components the proposal is.
 *
 * Nothing here is a right-to-left variant of anything. It is the ordinary
 * vocabulary — `Document`, `Section`, `Field`, `Table`, `Totals` — and the
 * direction is a token rather than anything this file writes. The root stamps
 * `dir` and `lang` onto its own element from the resolved set, exactly as an
 * HTML document declares them, and everything below inherits: the browser
 * starts every line on the right edge and lays each flex row's first column at
 * the right end, and the Chromium adapter prints the same tree through the same
 * engine.
 *
 * **There is no `Bundle`.** A bundle is one sequence of pages holding several
 * documents; a letter is one document, and the element walk stops at the first
 * root it finds. One root is what keeps one declaration from becoming two.
 *
 * **The column alignment is physical, and it is stated rather than inherited.**
 * `Table`'s `align` is `left` or `right` in the physical sense CSS means them,
 * so in a right-to-left row the description column asks for `right` — the edge
 * the row starts at — and the numeric columns ask for `left`, which is where an
 * Arabic schedule puts its amounts. Writing it out is what makes the two
 * outputs agree about it rather than each resolving `start` for itself.
 */

import type { Form } from "@paradoc/types";

import { Document } from "../components/document";
import { markDocumentRoot } from "@paradoc/react";
import type { DocumentData } from "@paradoc/react";
import { Field } from "../components/field";
import { Text } from "../components/text";
import { Section } from "../components/section";
import { Table } from "../components/table";
import { Totals } from "../components/totals";
import type { FormatOptions } from "@paradoc/react";
import type { DocumentTokensInput } from "@paradoc/react";
import { arabicLetterForm } from "./arabic-letter";

const arabicFormatter = createFormatter({ locale: "ar-SA", numberingSystem: "latn", overrides: { organization: (value) => String(value?.name ?? "") } });

export interface ArabicLetterDocumentProps {
  /** The letter data to render. */
  data: DocumentData;
  /** Overrides the artifact, for tests that vary it. */
  artifact?: Form;
  /**
   * Formatting options. Defaults to the letter's Arabic formatter.
   */
  format?: FormatOptions;
  /** Tenant branding, including the letter's Arabic direction and language. */
  tokens: DocumentTokensInput;
}

/**
 * The composition's content, below the `Document` that supplies its tokens: a
 * hook called in `ArabicLetterDocument`'s own body would see the package's defaults.
 * Text and field components own their typography, so the whole document
 * follows the resolved typography token.
 */
function ArabicLetterBody({ artifact }: { artifact: Form }) {
  return (
    <>

      <Section
        id="masthead"
        className="flex flex-row justify-between gap-8 border-b border-neutral-800 pb-4"
      >
        <div className="flex basis-1/2 flex-col gap-1">
          <Text as="span" keepId="title" role="heading">
            {artifact.title}
          </Text>
          <Field path="sender" label={false} className="text-neutral-700" />
          <Field path="senderAddress" label={false} className="text-neutral-600" />
          <Field path="senderPhone" label={false} className="text-neutral-600" />
        </div>
        <div className="flex basis-1/3 flex-col gap-2">
          <Field path="letterNumber" />
          <Field path="issuedOn" />
          <Field path="currency" />
        </div>
      </Section>

      <Section id="recipient" title="إلى" className="flex flex-col gap-1">
        <Field path="recipient" label={false} className="font-medium text-neutral-900" />
        <Field path="recipientContact" label={false} className="text-neutral-700" />
        <Field path="recipientAddress" label={false} className="text-neutral-600" />
      </Section>

      <Section id="body" title="الموضوع">
        <Field path="body" label={false} className="text-neutral-800" />
      </Section>

      <Section id="items" title="بنود الطلب" className="flex flex-col gap-3">
        <Table
          path="items"
          id="items"
          columns={[
            // The row starts on the right, so the description column starts
            // there too; the figures sit at the other end of the row.
            { field: "description", width: "basis-1/2", align: "right" },
            { field: "quantity", width: "basis-1/12", align: "left" },
            { field: "unit", width: "basis-1/12", align: "left" },
            { field: "unitPrice", width: "basis-1/6", align: "left" },
            { field: "amount", width: "basis-1/6", align: "left" },
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

      <Section id="closing" title="الخاتمة">
        <Field path="closing" label={false} className="text-neutral-800" />
      </Section>
    </>
  );
}

/** The composed letter. */
export function ArabicLetterDocument({
  data,
  artifact = arabicLetterForm,
  format = { formatter: arabicFormatter },
  tokens,
}: ArabicLetterDocumentProps) {
  return (
    <Document
      artifact={artifact}
      data={data}
      format={format}
      tokens={tokens}
      id="arabic-letter"
    >
      <ArabicLetterBody artifact={artifact} />
    </Document>
  );
}

markDocumentRoot(ArabicLetterDocument);
export default ArabicLetterDocument;
