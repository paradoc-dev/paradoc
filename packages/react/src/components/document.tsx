/**
 * `Document` takes the form artifact and its data and supplies both to
 * everything beneath it. It is the only component that knows how the artifact
 * is loaded; the rest of the tree names paths and party roles.
 */

import { useMemo, type ReactNode } from "react";
import { evaluateFormDefs } from "@paradoc/core";
import type { Form } from "@paradoc/types";

import { createValueFormatter, type FormatOptions } from "../lib/format";
import {
  createDocumentContext,
  DocumentContextProvider,
  type DocumentData,
  type SigningMarks,
} from "./document-context";

export interface DocumentProps {
  /** The form artifact this document renders. */
  artifact: Form;
  /** The field values and parties to render. */
  data: DocumentData;
  /** How values the serializer registry does not cover are formatted. */
  format?: FormatOptions;
  /**
   * Signing placeholders for a seal pass, keyed `role:index`. Absent for every
   * ordinary render, and a signature block then draws its own rule.
   */
  marks?: SigningMarks;
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
export function Document({ artifact, data, format, marks, id, className, children }: DocumentProps) {
  const context = useMemo(() => {
    const formatter = createValueFormatter(format);
    return createDocumentContext(artifact, data, evaluateDefs(artifact, data), formatter, marks);
  }, [artifact, data, format, marks]);

  return (
    <DocumentContextProvider value={context}>
      <article
        data-document-id={id ?? artifact.name}
        className={className ?? "flex flex-col gap-6 text-sm leading-relaxed text-neutral-900"}
      >
        {children}
      </article>
    </DocumentContextProvider>
  );
}
