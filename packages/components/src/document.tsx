import type { Form } from "@paradoc/types";
import {
  ArtifactProvider,
  DocumentTokensProvider,
  fontFamilyStyle,
  localeAttributes,
  useDocumentRootTokens,
  type DocumentData,
  type DocumentTokensInput,
  type FormatOptions,
} from "@paradoc/react";
import type { ReactNode } from "react";

export interface DocumentProps {
  artifact: Form;
  data: DocumentData;
  format?: FormatOptions;
  tokens?: DocumentTokensInput;
  id?: string;
  className?: string;
  children: ReactNode;
}

/** Copy-owned document markup bound through the headless runtime. */
export function Document({ artifact, data, format, tokens, id, className, children }: DocumentProps) {
  const branding = useDocumentRootTokens(tokens);
  return (
    <DocumentTokensProvider tokens={branding.tokens}>
      <ArtifactProvider artifact={artifact} data={data} format={format}>
        <article
          data-document-id={id ?? artifact.name}
          {...(branding.isRoot ? localeAttributes(branding.tokens) : {})}
          className={className ?? "flex flex-col gap-6 text-sm leading-relaxed text-neutral-900"}
          style={branding.isRoot ? fontFamilyStyle(branding.tokens) : undefined}
        >
          {children}
        </article>
      </ArtifactProvider>
    </DocumentTokensProvider>
  );
}
