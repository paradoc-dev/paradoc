/** @jsxRuntime classic */
import React from "react";
import type { ReactNode } from "react";
import {
  DocumentTokensProvider,
  fontFamilyStyle,
  localeAttributes,
  markDocumentRoot,
  useDocumentRootTokens,
  type DocumentTokensInput,
} from "@paradoc/react";

export interface BundleProps {
  id?: string;
  tokens?: DocumentTokensInput;
  className?: string;
  children: ReactNode;
}

export function Bundle({ id, tokens, className, children }: BundleProps) {
  const branding = useDocumentRootTokens(tokens);
  return <DocumentTokensProvider tokens={branding.tokens}>
    <div data-bundle-id={id ?? "bundle"} {...(branding.isRoot ? localeAttributes(branding.tokens) : {})} className={className ?? "flex flex-col gap-12"} style={branding.isRoot ? fontFamilyStyle(branding.tokens) : undefined}>{children}</div>
  </DocumentTokensProvider>;
}

markDocumentRoot(Bundle);
