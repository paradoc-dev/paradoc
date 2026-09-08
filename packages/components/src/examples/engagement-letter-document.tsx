/**
 * The engagement letter, composed from the components.
 *
 * One tree, built from `Document`, `Section`, `Field`, `KeepTogether` and
 * `Signature`, that carries no copy of any label or format. It is the same tree
 * the preview paginates and the PDF renders.
 *
 * **The clauses are keeps, not a table.** A numbered clause is a heading and a
 * paragraph that belong together: split one across a page and the number is on
 * the page above its own words. So each clause is one `KeepTogether`, which is
 * the whole of what makes it unbreakable — nothing here measures anything or
 * decides a page. The list is read from the data rather than written out,
 * because the artifact declares the clauses as a list and a composition that
 * hard-coded ten of them would render nine when a filler supplies nine.
 *
 * **The clause text is read from the context, not from a nested `Field`.** A
 * `Field` is itself a keep, and a keep inside a keep is measured twice: the
 * plan would see the clause and its own paragraph as two overlapping units. So
 * the clause draws the value the same way `Field` does — through the document's
 * formatter, at the path the artifact names — and stays one unit.
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
import { useList, type DocumentData } from "@paradoc/react";
import { Field } from "../components/field";
import { KeepTogether } from "../components/keep-together";
import { usePage } from "@paradoc/react";
import { Section } from "../components/section";
import { Signature } from "../components/signature";
import type { FormatOptions } from "@paradoc/react";
import type { DocumentTokensInput } from "@paradoc/react";
import { engagementLetterForm } from "./engagement-letter";

/** Stable keep prefix for the numbered clauses. The PDF is hinted with the same ids. */
const CLAUSE_KEEP_PREFIX = "clause";

/**
 * The scope of services, one numbered keep per clause.
 *
 * The wrapper is not a keep, so it has to withdraw on its own, exactly as
 * `Table`'s does: a page holding none of the clauses renders no list at all,
 * because an empty flex child still takes the section's gap and would make the
 * rendered page taller than the flow the plan was measured against.
 */
function Clauses({ path }: { path: string }) {
  const list = useList(path);
  const page = usePage();
  const rows = list.rows;

  const keepIds = rows.map((_clause, index) => `${CLAUSE_KEEP_PREFIX}:${index}`);
  if (page && !keepIds.some((keepId) => page.keeps.has(keepId))) return null;

  return (
    <div className="flex flex-col gap-3">
      {rows.map((_clause, index) => {
        const headingPath = `${path}.${index}.heading`;
        const detailPath = `${path}.${index}.detail`;
        return (
          <KeepTogether
            key={keepIds[index]}
            keepId={keepIds[index]!}
            className="flex flex-row gap-4"
          >
            <span className="basis-1/12 text-sm font-semibold text-neutral-500">{index + 1}.</span>
            <span className="flex basis-11/12 flex-col gap-1">
              <span data-field-path={headingPath} className="text-sm font-semibold text-neutral-900">
                {list.text(index, "heading")}
              </span>
              <span data-field-path={detailPath} className="text-sm leading-relaxed text-neutral-800">
                {list.text(index, "detail")}
              </span>
            </span>
          </KeepTogether>
        );
      })}
    </div>
  );
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
      <Section id="masthead" className="flex flex-row justify-between gap-8 border-b border-neutral-800 pb-4">
        <div className="flex basis-1/2 flex-col gap-1">
          <KeepTogether as="span" keepId="title" className="text-lg font-semibold text-neutral-900">
            {artifact.title}
          </KeepTogether>
          <Field path="firm" label={false} className="text-sm text-neutral-700" />
          <Field path="firmAddress" label={false} className="text-sm text-neutral-600" />
        </div>
        <div className="flex basis-1/3 flex-col gap-2">
          <Field path="reference" />
          <Field path="effectiveDate" />
        </div>
      </Section>

      <Section id="client" title="To" className="flex flex-col gap-1">
        <Field path="client" label={false} className="text-sm font-medium text-neutral-900" />
        <Field path="clientContact" label={false} className="text-sm text-neutral-700" />
        <Field path="clientAddress" label={false} className="text-sm text-neutral-600" />
      </Section>

      <Section id="matter" title="Matter">
        <Field path="matter" label={false} className="text-sm leading-relaxed text-neutral-800" />
      </Section>

      <Section id="scope" title="Scope of services">
        <Clauses path="scopeOfServices" />
      </Section>

      <Section id="fees" title="Fees" className="flex flex-col gap-2">
        <Field path="feeBasis" label={false} className="text-sm leading-relaxed text-neutral-800" />
        <Field path="retainer" className="flex flex-col gap-0.5 text-sm text-neutral-800" />
      </Section>

      <Section id="term" title="Term and termination" className="flex flex-col gap-2">
        <Field path="term" label={false} className="text-sm leading-relaxed text-neutral-800" />
        <Field path="termination" label={false} className="text-sm leading-relaxed text-neutral-800" />
      </Section>

      <Section id="governing-law" title="Governing law">
        <Field path="governingLaw" label={false} className="text-sm leading-relaxed text-neutral-800" />
      </Section>

      <Section id="acceptance" title="Agreed" className="flex flex-col gap-4 pt-4">
        <div className="flex flex-row gap-10">
          <Signature party="firm" className="flex basis-1/2 flex-col gap-1" />
          <Signature party="client" className="flex basis-1/2 flex-col gap-1" />
        </div>
      </Section>
    </Document>
  );
}

markDocumentRoot(EngagementLetterDocument);
export default EngagementLetterDocument;
