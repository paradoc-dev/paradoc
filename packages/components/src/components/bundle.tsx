/** @jsxRuntime classic */
import React from "react";
import type { ReactNode } from "react";
import {
  DocumentTokensProvider,
  localeAttributes,
  markDocumentRoot,
  useDocumentRootTokens,
  type DocumentTokensInput,
} from "@paradoc/react";

export interface BundleProps {
  /**
   * Groups this bundle's documents under one id, distinguishing bundles
   * rendered side by side.
   * @default "bundle"
   */
  id?: string;
  /** Tenant branding cascaded to every document and component nested inside the bundle. */
  tokens?: DocumentTokensInput;
  /** Classes for the wrapping element around the bundle's documents. */
  className?: string;
  /** The bundle's documents. */
  children: ReactNode;
}

export function Bundle({ id, tokens, className, children }: BundleProps) {
  const branding = useDocumentRootTokens(tokens);
  return <DocumentTokensProvider tokens={branding.tokens}>
    <div data-bundle-id={id ?? "bundle"} {...(branding.isRoot ? localeAttributes(branding.tokens) : {})} className={className ?? "flex flex-col gap-12"}>{children}</div>
  </DocumentTokensProvider>;
}

markDocumentRoot(Bundle);
