/**
 * The engagement letter, composed from the components.
 *
 * One tree, built from `Document`, `Section`, `Text`, `Party`, `Field`, `List`
 * and `Signature`, that carries no copy of any label or format and
 * sizes none of its own text. It is the same tree the preview paginates and the
 * PDF renders; `engagementLetterFurniture` numbers its pages in both.
 *
 * **The clauses are a `List`, not a hand-built row.** A numbered clause is a
 * heading and a paragraph that belong together: split one across a page and the
 * number is on the page above its own words. `List` is exactly that rule —
 * every item is one keep, keyed `clause:<index>`, and the level withdraws from
 * a page holding none of them — so the composition writes no marker, no keep
 * and no withdrawal of its own. The items are read from the data rather than
 * written out, because the artifact declares the clauses as a list and a
 * composition that hard-coded ten of them would render nine when a filler
 * supplies nine.
 *
 * **The clause text is read from the context, not from a nested `Field` or
 * `Text`.** An item is a keep, and a keep inside a keep is measured twice: the
 * plan would see the clause and its own paragraph as two overlapping units. So
 * the clause draws the value the same way `Field` does — through the document's
 * formatter, at the path the artifact names — and stays one unit, set in the
 * item's own body text with only the heading's weight added. The prose fields
 * outside the clauses are `Field`s of their own, and the long ones are printed
 * as paragraphs so a filler's blank line breaks the page rather than
 * overflowing it.
 *
 * **The parties are `Party` blocks.** The firm and the client are the
 * artifact's parties, so each is named by its own block. Their addresses and
 * the client's contact are fields beside it: the party schema models the party
 * itself, not where it is or who in it the letter is addressed to.
 *
 * **There is no `Bundle`.** A letter is one document, and the element walk
 * stops at the first root it finds. One root is what keeps one declaration from
 * becoming two.
 */
/** @jsxRuntime classic */
import React from "react";
import type { Form } from "@paradoc/types";

import { Document } from "../components/document";
import { markDocumentRoot } from "@paradoc/react";
import { useList, type DocumentData, type PageFurniture } from "@paradoc/react";
import { Field } from "../components/field";
import { List, type ListItem } from "../components/list";
import { PageNumber } from "../components/page-number";
import { Party } from "../components/party";
import { Section } from "../components/section";
import { Signature } from "../components/signature";
import { Text } from "../components/text";
import type { FormatOptions } from "@paradoc/react";
import type { DocumentTokensInput } from "@paradoc/react";
import { engagementLetterForm } from "./engagement-letter";

/** Stable keep prefix for the numbered clauses. The PDF is hinted with the same ids. */
const CLAUSE_KEEP_PREFIX = "clause";

/**
 * The scope of services, one numbered clause per item.
 *
 * The marker, the keep per item and the withdrawal from a page holding none of
 * them are all `List`'s. What is left here is the one thing the component
 * cannot know: that a clause is a heading over its own detail, at two paths the
 * artifact declares.
 */
function Clauses({ path }: { path: string }) {
  const list = useList(path);

  // Both lines take the item's own size and leading from `List`; the heading
  // adds only its weight.
  const items: ListItem[] = list.rows.map((_clause, index) => ({
    text: (
      <span className="flex flex-col gap-1">
        <span data-field-path={`${path}.${index}.heading`} className="font-semibold text-neutral-900">
          {list.text(index, "heading")}
        </span>
        <span data-field-path={`${path}.${index}.detail`}>{list.text(index, "detail")}</span>
      </span>
    ),
  }));

  return <List id={CLAUSE_KEEP_PREFIX} items={items} />;
}

/**
 * The letter's page furniture: the page number and the count, in the footer.
 *
 * Hand the same object to `<Pages furniture>` and to `renderPdf`, so the
 * preview and the PDF number the same pages. It is drawn inside the margin, so
 * the page plan and the page count are what they are without it.
 */
export const engagementLetterFurniture: PageFurniture = { footer: <PageNumber /> };

export interface EngagementLetterDocumentProps {
  /** The engagement letter data to render. */
  data: DocumentData;
  /** Overrides the artifact, for tests that vary it. */
  artifact?: Form;
  /** How values the serializer registry does not cover are formatted, and which registry (US or EU) covers the rest. */
  format?: FormatOptions;
  /** Tenant branding. See `src/examples/tokens.ts` for a set that changes every token. */
  tokens?: DocumentTokensInput;
}

/**
 * The composition's content. Nothing here sizes its own text: the title is a
 * `Text` heading, the parties are `Party` blocks, and every value inherits the
 * document's body size, so the whole letter follows `typography`.
 */
function EngagementLetterBody({ artifact }: { artifact: Form }) {
  return (
    <>

      <Section id="masthead" className="flex flex-row justify-between gap-8 border-b border-neutral-800 pb-4">
        <div className="flex basis-1/2 flex-col gap-1">
          <Text keepId="title" role="heading" as="span">
            {artifact.title}
          </Text>
          <Party role="firm" label={false} />
          <Field path="firmAddress" label={false} />
        </div>
        <div className="flex basis-1/3 flex-col gap-2">
          <Field path="reference" />
          <Field path="effectiveDate" />
        </div>
      </Section>

      <Section id="client" title="To" className="flex flex-col gap-1">
        <Party role="client" label={false} className="flex flex-col gap-0.5 font-medium" />
        <Field path="clientContact" label={false} />
        <Field path="clientAddress" label={false} />
      </Section>

      <Section id="matter" title="Matter">
        <Field path="matter" label={false} paragraphs />
      </Section>

      <Section id="scope" title="Scope of services">
        <Clauses path="scopeOfServices" />
      </Section>

      <Section id="fees" title="Fees" className="flex flex-col gap-2">
        <Field path="feeBasis" label={false} paragraphs />
        <Field path="retainer" />
      </Section>

      <Section id="term" title="Term and termination" className="flex flex-col gap-2">
        <Field path="term" label={false} paragraphs />
        <Field path="termination" label={false} paragraphs />
      </Section>

      <Section id="governing-law" title="Governing law">
        <Field path="governingLaw" label={false} paragraphs />
      </Section>

      <Section id="acceptance" title="Agreed" className="flex flex-col gap-4 pt-4">
        <div className="flex flex-row gap-10">
          <Signature party="firm" className="flex basis-1/2 flex-col gap-1" />
          <Signature party="client" className="flex basis-1/2 flex-col gap-1" />
        </div>
      </Section>
    </>
  );
}

/**
 * The composed engagement letter.
 *
 * Exported by name and as the module's default. The default is what a React
 * layer binds to when the renderer imports the module the layer's path names,
 * which is the convention a composition module follows.
 */
export function EngagementLetterDocument({
  data,
  artifact = engagementLetterForm,
  format,
  tokens,
}: EngagementLetterDocumentProps) {
  return (
    <Document artifact={artifact} data={data} format={format} tokens={tokens} id="engagement-letter">
      <EngagementLetterBody artifact={artifact} />
    </Document>
  );
}

markDocumentRoot(EngagementLetterDocument);
export default EngagementLetterDocument;
