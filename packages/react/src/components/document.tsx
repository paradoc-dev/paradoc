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
 * threads a seal-only prop.
 */

import { useMemo, type ReactNode } from "react";
import { evaluateFormDefs } from "@paradoc/core";
import type { Form } from "@paradoc/types";

import { createValueFormatter, type FormatOptions } from "../lib/format";
import { fontFamilyStyle, type DocumentTokensInput } from "../lib/tokens";
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
  // The seal's flow markers arrive from the layer's renderer, not from the
  // composition: a document is written once and rendered in both seal passes.
  const marks = useSigningMarks();


  const context = useMemo(() => {
    const formatter = createValueFormatter(format);
    return createDocumentContext(artifact, data, evaluateDefs(artifact, data), formatter, marks);
  }, [artifact, data, format, marks]);

  return (
    <DocumentTokensProvider tokens={branding.tokens}>
      <DocumentContextProvider value={context}>
        <article
          data-document-id={id ?? artifact.name}
          className={className ?? "flex flex-col gap-6 text-sm leading-relaxed text-neutral-900"}
          // The browser reaches the typeface through this property, which
          // `styles.css` reads; the PDF reaches the same files through the
          // engine's font registry. Only the root sets it, because a bundle is
          // one document sequence in one typeface.
          style={branding.isRoot ? fontFamilyStyle(branding.tokens) : undefined}
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
