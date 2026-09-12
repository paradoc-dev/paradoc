/** @jsxRuntime classic */
import React from "react";
import type { Form } from "@paradoc/types";
import {
  ArtifactProvider,
  DocumentTokensProvider,
  flowGapClasses,
  localeAttributes,
  markDocumentRoot,
  scaleTextClasses,
  useDocumentRootTokens,
  type DocumentData,
  type DocumentTokensInput,
  type FormatOptions,
} from "@paradoc/react";
import type { ReactNode } from "react";

export interface DocumentProps {
  /** The form artifact this document binds to; every component beneath it reads from it. */
  artifact: Form;
  /** The values that fill the artifact's fields. */
  data: DocumentData;
  /** How values without a matching serializer are formatted, and which locale registry covers the rest. */
  format?: FormatOptions;
  /** Tenant branding applied to this document and every component nested inside it. */
  tokens?: DocumentTokensInput;
  /** Pagination id for this document; falls back to the artifact's own name. */
  id?: string;
  /** Classes for the document's wrapping element. */
  className?: string;
  /** The document's composed content. */
  children: ReactNode;
}

/** Copy-owned document markup bound through the headless runtime. */
export function Document({ artifact, data, format, tokens, id, className, children }: DocumentProps) {
  const branding = useDocumentRootTokens(tokens);
  const { scale, flow } = branding.tokens.typography;
  return (
    <DocumentTokensProvider tokens={branding.tokens}>
      <ArtifactProvider artifact={artifact} data={data} format={format}>
        <article
          data-document-id={id ?? artifact.name}
          {...(branding.isRoot ? localeAttributes(branding.tokens) : {})}
          className={className ?? flowGapClasses(scaleTextClasses("flex flex-col gap-6 text-sm leading-relaxed text-neutral-900", scale), flow)}
        >
          {children}
        </article>
      </ArtifactProvider>
    </DocumentTokensProvider>
  );
}

markDocumentRoot(Document);
