/**
 * The engagement letter, composed from the components.
 *
 * One tree, built from `Document`, `Section`, `Field`, `KeepTogether` and
 * `Signature`, that carries no copy of any label or format. It is the same tree
 * the preview paginates and the PDF renders.
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
 * formatter, at the path the artifact names — and stays one unit. The prose
 * fields outside the clauses are `Field`s of their own, and the long ones are
 * printed as paragraphs so a filler's blank line breaks the page rather than
 * overflowing it.
 *
 * **There is no `Bundle`.** A letter is one document, and the element walk
 * stops at the first root it finds. One root is what keeps one declaration from
 * becoming two.
 */
/** @jsxRuntime classic */
import React from "react";
import type { Form } from "@paradoc/types";

import { Document } from "../components/document";
import { flowGapClasses, markDocumentRoot, scaleTextClasses, useDocumentTokens } from "@paradoc/react";
import { useList, type DocumentData } from "@paradoc/react";
import { Field } from "../components/field";
import { KeepTogether } from "../components/keep-together";
import { List, type ListItem } from "../components/list";
import { Section } from "../components/section";
import { Signature } from "../components/signature";
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
  const { typography } = useDocumentTokens();
  const type = (classes: string) => scaleTextClasses(classes, typography.scale);

  const items: ListItem[] = list.rows.map((_clause, index) => ({
    text: (
      <span className="flex flex-col gap-1">
        <span data-field-path={`${path}.${index}.heading`} className={type("text-sm font-semibold text-neutral-900")}>
          {list.text(index, "heading")}
        </span>
        <span data-field-path={`${path}.${index}.detail`} className={type("text-sm leading-relaxed text-neutral-800")}>
          {list.text(index, "detail")}
        </span>
      </span>
    ),
  }));

  return <List id={CLAUSE_KEEP_PREFIX} items={items} />;
}

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
 * The composition's content, below the `Document` that supplies its tokens: a
 * hook called in `EngagementLetterDocument`'s own body would see the package's defaults.
 * Every size and leading here is routed through the token, so the whole
 * document follows `typography` rather than the components alone.
 */
function EngagementLetterBody({ artifact }: { artifact: Form }) {
  const { typography } = useDocumentTokens();
  const type = (classes: string) => scaleTextClasses(classes, typography.scale);
  // The letter's running prose: paragraphs at the document's own rhythm, so a
  // filler's blank line breaks the page instead of overflowing it. Written
  // once rather than at each of the five fields that carry it, and stepped
  // through both helpers because a gap follows `flow` while a size follows
  // `scale`.
  const prose = flowGapClasses(
    type("flex flex-col gap-3 text-sm leading-relaxed text-neutral-800"),
    typography.flow
  );
  return (
    <>

      <Section id="masthead" className="flex flex-row justify-between gap-8 border-b border-neutral-800 pb-4">
        <div className="flex basis-1/2 flex-col gap-1">
          <KeepTogether as="span" keepId="title" className={type("text-lg font-semibold text-neutral-900")}>
            {artifact.title}
          </KeepTogether>
          <Field path="firm" label={false} className={type("text-sm text-neutral-700")} />
          <Field path="firmAddress" label={false} className={type("text-sm text-neutral-600")} />
        </div>
        <div className="flex basis-1/3 flex-col gap-2">
          <Field path="reference" />
          <Field path="effectiveDate" />
        </div>
      </Section>

      <Section id="client" title="To" className="flex flex-col gap-1">
        <Field path="client" label={false} className={type("text-sm font-medium text-neutral-900")} />
        <Field path="clientContact" label={false} className={type("text-sm text-neutral-700")} />
        <Field path="clientAddress" label={false} className={type("text-sm text-neutral-600")} />
      </Section>

      <Section id="matter" title="Matter">
        <Field path="matter" label={false} paragraphs className={prose} />
      </Section>

      <Section id="scope" title="Scope of services">
        <Clauses path="scopeOfServices" />
      </Section>

      <Section id="fees" title="Fees" className="flex flex-col gap-2">
        <Field path="feeBasis" label={false} paragraphs className={prose} />
        <Field path="retainer" className={type("flex flex-col gap-0.5 text-sm text-neutral-800")} />
      </Section>

      <Section id="term" title="Term and termination" className="flex flex-col gap-2">
        <Field path="term" label={false} paragraphs className={prose} />
        <Field path="termination" label={false} paragraphs className={prose} />
      </Section>

      <Section id="governing-law" title="Governing law">
        <Field path="governingLaw" label={false} paragraphs className={prose} />
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
