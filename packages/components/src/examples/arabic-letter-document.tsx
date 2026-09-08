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
import { KeepTogether } from "../components/keep-together";
import { Section } from "../components/section";
import { Table } from "../components/table";
import { Totals } from "../components/totals";
import type { FormatOptions } from "@paradoc/react";
import type { DocumentTokensInput } from "@paradoc/react";
import { arabicLetterForm, arabicLetterTokens } from "./arabic-letter";

const arabicFormatter = createFormatter({ locale: "ar-SA", numberingSystem: "latn", overrides: { organization: (value, options, context) => { context.delegate(value, options); return String(value?.name ?? ""); } } });

export interface ArabicLetterDocumentProps {
  /** The letter data to render. */
  data: DocumentData;
  /** Overrides the artifact, for tests that vary it. */
  artifact?: Form;
  /**
   * Which registry the values are serialized through. `ar` is the letter's own;
   * the prop exists so a test can render it through another one and see the
   * difference.
   */
  format?: FormatOptions;
  /**
   * Tenant branding. It defaults to the letter's own set, because a sample that
   * was wrong until a caller passed the right tokens would be a sample nobody
   * could copy. A caller layering its own set over it still has to carry the
   * script's family, direction and language, or the document fails naming what
   * is missing.
   */
  tokens?: DocumentTokensInput;
}

/** The composed letter. */
export function ArabicLetterDocument({
  data,
  artifact = arabicLetterForm,
  format = { formatter: arabicFormatter },
  tokens = arabicLetterTokens,
}: ArabicLetterDocumentProps) {
  return (
    <Document
      artifact={artifact}
      data={data}
      format={format}
      tokens={tokens}
      id="arabic-letter"
    >
      <Section
        id="masthead"
        className="flex flex-row justify-between gap-8 border-b border-neutral-800 pb-4"
      >
        <div className="flex basis-1/2 flex-col gap-1">
          <KeepTogether
            as="span"
            keepId="title"
            className="text-lg font-semibold text-neutral-900"
          >
            {artifact.title}
          </KeepTogether>
          <Field path="sender" label={false} className="text-sm text-neutral-700" />
          <Field path="senderAddress" label={false} className="text-sm text-neutral-600" />
          <Field path="senderPhone" label={false} className="text-sm text-neutral-600" />
        </div>
        <div className="flex basis-1/3 flex-col gap-2">
          <Field path="letterNumber" />
          <Field path="issuedOn" />
          <Field path="currency" />
        </div>
      </Section>

      <Section id="recipient" title="إلى" className="flex flex-col gap-1">
        <Field path="recipient" label={false} className="text-sm font-medium text-neutral-900" />
        <Field path="recipientContact" label={false} className="text-sm text-neutral-700" />
        <Field path="recipientAddress" label={false} className="text-sm text-neutral-600" />
      </Section>

      <Section id="body" title="الموضوع">
        <Field path="body" label={false} className="text-sm leading-relaxed text-neutral-800" />
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
        <Field path="closing" label={false} className="text-sm leading-relaxed text-neutral-800" />
      </Section>
    </Document>
  );
}

markDocumentRoot(ArabicLetterDocument);
export default ArabicLetterDocument;
