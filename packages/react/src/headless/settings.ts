import { useMemo, type CSSProperties, type ReactNode } from "react";

import { useTokenOverride } from "../components/tokens-context";
import { drawnPaper, type DrawnPaper } from "../components/paper-geometry";
import { documentTokensOf } from "../lib/document-tokens";
import type { DocumentTokens, PageGeometry } from "../lib/tokens";

export interface DocumentSettingsBinding {
  drawn: DrawnPaper;
  tokens: DocumentTokens;
  geometry: PageGeometry;
  sheetStyle: CSSProperties;
}

/** Resolves the settings declared by one explicit document root. */
export function useDocumentSettings(children: ReactNode): DocumentSettingsBinding {
  const override = useTokenOverride();
  const drawn = useMemo(() => drawnPaper(documentTokensOf(children, override)), [children, override]);
  const sheetStyle = useMemo<CSSProperties>(() => ({}), []);
  return { drawn, tokens: drawn.tokens, geometry: drawn.geometry, sheetStyle };
}
