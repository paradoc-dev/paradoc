/**
 * Partial mode: the document below is still being filled.
 *
 * A composition renders the same tree whether it is finished or half answered,
 * but the two want opposite things from a value the data has not supplied yet.
 * A finished document with a hole in it is a bug and must fail loudly. A
 * document a session is part-way through answering is *supposed* to have holes,
 * and every state between empty and complete is a document somebody is looking
 * at.
 *
 * Only the caller knows which of the two it is rendering, so partial mode is
 * off unless something turns it on. A `Document` may name it directly on its
 * `format` prop; this context is how a caller that does not own the element
 * turns it on for a whole tree, which is what `renderPdf({ partial: true })`
 * and the composition check both need.
 *
 * `Document` reads this on every render, partial or not, so it is substrate an
 * installed `document.tsx` reaches through the package rather than a copy of
 * its own, for the reason `useSigningMarks` is.
 */

import { createContext, useContext, type ReactNode } from "react";

const PartialValuesContext = createContext(false);

export interface PartialValuesProviderProps {
  /** True while the tree below is a document that is still being filled. */
  partial: boolean;
  children?: ReactNode;
}

/** Turns partial mode on, or off, for the tree below. */
export function PartialValuesProvider({ partial, children }: PartialValuesProviderProps) {
  return <PartialValuesContext.Provider value={partial}>{children}</PartialValuesContext.Provider>;
}

/** True when the surrounding caller said the document is still being filled. */
export function usePartialValues(): boolean {
  return useContext(PartialValuesContext);
}
