/**
 * What `renderPdf` puts around the element before an engine sees it.
 *
 * Two wrappers, both of them contexts that emit no markup, so the tree an
 * adapter resolves is still the tree the caller wrote.
 *
 * **The override**, when the render supplies one: the document root reads it as
 * the last layer of its own resolution, and `documentTokensOf` recognises the
 * provider too, so the tokens the geometry was built from and the tokens the
 * document resolves are the same tokens.
 *
 * **What the render resolved**, always: the same context `Pages` and `Paper`
 * supply. Without it the document root has nothing to check itself against, and
 * a composition whose tokens the element walk could not see renders US Letter
 * in Inter with no error at all — on every server render, which is every render
 * a React layer performs.
 */

import type { ReactNode } from "react";

import { DrawnPaperProvider, drawnPaper } from "../components/paper-geometry";
import { PartialValuesProvider } from "../components/partial-context";
import { TokenOverrideProvider } from "../components/tokens-context";
import type { DocumentTokens, DocumentTokensInput } from "../lib/tokens";

/** Puts one render's tokens above the document, or leaves the tree alone. */
export function withTokenOverride(
  element: ReactNode,
  tokens: DocumentTokensInput | undefined
): ReactNode {
  if (tokens === undefined) return element;
  return <TokenOverrideProvider tokens={tokens}>{element}</TokenOverrideProvider>;
}

/**
 * Tells the document below that it is one somebody is still answering, or
 * leaves the tree alone.
 *
 * Only when the render asked for it. A render that says nothing leaves the tree
 * untouched rather than wrapping it in a provider carrying `false`, so the tree
 * an engine lays out is byte for byte the tree it always was.
 */
export function withPartialValues(element: ReactNode, partial: boolean | undefined): ReactNode {
  if (partial !== true) return element;
  return <PartialValuesProvider partial>{element}</PartialValuesProvider>;
}

/** Tells the document below what this render resolved, so it can check itself. */
export function withDrawnPaper(element: ReactNode, tokens: DocumentTokens): ReactNode {
  return <DrawnPaperProvider value={drawnPaper(tokens)}>{element}</DrawnPaperProvider>;
}
