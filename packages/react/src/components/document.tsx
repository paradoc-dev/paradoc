import { useArtifactFormatting } from "./formatter-context";
/**
 * `Document` takes the form artifact and its data and supplies both to
 * everything beneath it. It is the only component that knows how the artifact
 * is loaded; the rest of the tree names paths and party roles.
 *
 * It is also where a tenant's branding enters. `tokens` is resolved against
 * whatever a `Bundle` above already set and whatever the render overrides, and
 * the result is supplied to the tree below and published to the page furniture
 * above, so the preview's sheet and the PDF's page are the same paper.
 *
 * The seal's flow markers enter here too, but from the other direction: the
 * layer's renderer supplies them and this reads them, so a composition never
 * threads a seal-only prop. Partial mode arrives the same way, from whichever
 * caller knows that the document below is one somebody is still answering.
 *
 * The script is branding too. `dir` and `lang` are root-only tokens, so the
 * root writes them onto its element as HTML writes them, and the render reads
 * the same resolution off the same element. A document that names a language
 * its typeface carries no glyphs for fails while it resolves, rather than
 * rendering null glyphs on paper and a substituted face on screen.
 *
 * The tag is a declaration, though, and a document that declares nothing is the
 * case it cannot catch. So the root also reads the text it is about to print —
 * one pass over the artifact's labels and the data's values, memoized on both —
 * and fails the same way when that text is in a script the family cannot set.
 * That is the case `<ArabicLetterDocument data={...} />` with no tokens is: a
 * whole document of null glyphs that nothing else would have reported.
 */

import { useMemo, type ReactNode } from "react";
import { evaluateFormDefs } from "@paradoc/core";
import type { Form } from "@paradoc/types";

import { useUnresolvedPathCollector } from "./check-context";
import { usePartialValues } from "./partial-context";
import { createValueFormatter, type FormatOptions } from "../lib/format";
import { localeAttributes, type DocumentTokensInput } from "../lib/tokens";
import {
  createDocumentContext,
  DocumentContextProvider,
  type DocumentData,
} from "./document-context";
import { useSigningMarks } from "./signing-context";
import {
  DocumentTokensProvider,
  markDocumentRoot,
  useDocumentRootTokens,
} from "./tokens-context";

export interface DocumentProps {
  /** The form artifact this document renders. */
  artifact: Form;
  /** The field values and parties to render. */
  data: DocumentData;
  /** How values the serializer registry does not cover are formatted. */
  format?: FormatOptions;
  /**
   * Tenant branding: typeface, accent colour, paper and mark. Anything omitted
   * keeps the value the bundle above set, or the package's default.
   */
  tokens?: DocumentTokensInput;
  /** Stable identifier for this document within its bundle. */
  id?: string;
  className?: string;
  children: ReactNode;
}

function evaluateDefs(artifact: Form, data: DocumentData): Map<string, unknown> {
  const result = evaluateFormDefs(artifact, { fields: data.fields, parties: data.parties });
  return "value" in result && result.value ? result.value.defsValues : new Map<string, unknown>();
}

/** Binds one form artifact and its data to the component tree below it. */
export function Document({
  artifact,
  data,
  format,
  tokens,
  id,
  className,
  children,
}: DocumentProps) {
  const branding = useDocumentRootTokens(tokens);
  // The text, not the tag. Memoized on the artifact, the data and the family,
  // which is every input it has, so it is one pass per document rather than one
  // per render. Only the root checks: a nested document is set in the bundle's
  // family and the bundle already answered for it.
  // The seal's flow markers arrive from the layer's renderer, not from the
  // composition: a document is written once and rendered in both seal passes.
  const marks = useSigningMarks();
  // Present only inside `@paradoc/react/check`'s `CheckModeProvider`; every
  // other render sees `undefined` and `createDocumentContext` throws exactly
  // as it always has.
  const collector = useUnresolvedPathCollector();
  // Whether the document below is one somebody is still answering. The prop
  // wins where a composition states it; otherwise it is whatever the caller
  // around the element said, which is how `renderPdf` and the check turn it on
  // for a tree they do not own. Off unless something says so.
  const surrounding = usePartialValues();
  const partial = format?.partial ?? surrounding;
  const inherited = useArtifactFormatting();

  const context = useMemo(() => {
    const formatter = createValueFormatter({ ...format, partial, formatter: inherited.formatter ?? format?.formatter, progressive: inherited.progressive ?? format?.progressive });
    return createDocumentContext(artifact, data, evaluateDefs(artifact, data), formatter, marks, collector);
  }, [artifact, data, format, partial, marks, collector, format?.formatter, format?.progressive, inherited.formatter, inherited.progressive]);

  return (
    <DocumentTokensProvider tokens={branding.tokens}>
      <DocumentContextProvider value={context}>
        <article
          data-document-id={id ?? artifact.name}
          // Only the root, and only when they are not the initial values both
          // outputs already apply: writing `dir="ltr" lang="en"` onto every
          // document that never asked about its script would change the bytes
          // of every rendered PDF for nothing.
          {...(branding.isRoot ? localeAttributes(branding.tokens) : {})}
          className={className ?? "flex flex-col gap-6 text-sm leading-relaxed text-neutral-900"}
          // The browser reaches the typeface through this property, which
          // `styles.css` reads; the PDF reaches the same files through the
          // engine's font registry. Only the root sets it, because a bundle is
          // one document sequence in one typeface.
        >
          {children}
        </article>
      </DocumentContextProvider>
    </DocumentTokensProvider>
  );
}

// The page furniture and `renderPdf` read a document's tokens off the element
// rather than by rendering it, and this is how they recognise one.
markDocumentRoot(Document);
