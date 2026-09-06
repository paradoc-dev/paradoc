/**
 * `Bundle` holds the documents of one composition, mirroring the artifact
 * hierarchy's outermost level. It carries no artifact of its own; each
 * `Document` beneath it binds its own.
 *
 * It does carry the branding, because a packet is one branded thing: tokens set
 * here reach every document in the bundle, and a document may still name a
 * token of its own on top of them. The paper it resolves is the paper the whole
 * sequence is drawn on.
 */

import type { ReactNode } from "react";

import { fontFamilyStyle, type DocumentTokensInput } from "../lib/tokens";
import {
  DocumentTokensProvider,
  markDocumentRoot,
  useDocumentRootTokens,
} from "./tokens-context";

export interface BundleProps {
  /** Stable identifier for the bundle. */
  id?: string;
  /**
   * Tenant branding for every document in the bundle: typeface, accent colour,
   * paper and mark. Anything omitted keeps the package's default.
   */
  tokens?: DocumentTokensInput;
  className?: string;
  children: ReactNode;
}

/** Groups one or more documents. */
export function Bundle({ id, tokens, className, children }: BundleProps) {
  const branding = useDocumentRootTokens(tokens);

  return (
    <DocumentTokensProvider tokens={branding.tokens}>
      <div
        data-bundle-id={id ?? "bundle"}
        className={className ?? "flex flex-col gap-12"}
        style={branding.isRoot ? fontFamilyStyle(branding.tokens) : undefined}
      >
        {children}
      </div>
    </DocumentTokensProvider>
  );
}

// Recognised by the element walk, for the reason `Document` is.
markDocumentRoot(Bundle);
