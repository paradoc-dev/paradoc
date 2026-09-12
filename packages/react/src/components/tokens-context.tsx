/**
 * Where a document's branding is declared, and the two rules that keep one
 * document on one paper.
 *
 * Tokens enter at the document root, which is `Document` or the `Bundle` above
 * it. Everything the tokens style is below that root, so the resolved set flows
 * to it as ordinary React context.
 *
 * The page furniture and the PDF path are *above* the root and read the same
 * tokens off the element instead, synchronously, through `documentTokensOf`.
 * Nothing travels upward: see `src/lib/document-tokens.ts` for why.
 *
 * **A render may override the tokens for one tenant.** `renderPdf` takes a
 * token set; the preview's equivalent is `TokenOverrideProvider` above the page
 * furniture. Either way it is the last layer of the root's own resolution, and
 * a layer rather than a replacement, so a render can change the accent without
 * also deciding the paper.
 *
 * **Two rules, both loud.** Paper, script, and rhythm are declared once, at the
 * root: a nested `Document` that sets them fails rather than having them
 * dropped. And a root whose paper, script, or rhythm is not the one being drawn
 * with fails naming the token, which is what catches a composition that hides its tokens somewhere the
 * element walk cannot see. The second check runs on both sides, because
 * `renderPdf` supplies the same context the furniture does.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";

import {
  DOCUMENT_ROOT,
  TOKEN_OVERRIDE,
  documentTokensOf,
  type TokenMarkers,
} from "../lib/document-tokens";
import {
  disagreeingRootToken,
  resolveDocumentTokens,
  ROOT_ONLY_TOKEN_KEYS,
  type DocumentTokens,
  type DocumentTokensInput,
} from "../lib/tokens";
import { useDrawnPaper } from "./paper-geometry";

const DocumentTokensContext = createContext<DocumentTokens | null>(null);
const TokenOverrideContext = createContext<DocumentTokensInput | undefined>(undefined);

/**
 * The resolved branding of the document being rendered.
 *
 * A composition reads it to place what the components do not own — the
 * organization's mark, most often. Outside a `Document` or `Bundle` it is the
 * package's defaults, so a component can always ask.
 */
export function useDocumentTokens(): DocumentTokens {
  return useContext(DocumentTokensContext) ?? resolveDocumentTokens();
}

/**
 * The tokens that govern `children`, read from wherever they are declared.
 *
 * For something that sits *above* a document root and draws around it — a
 * packet's `Part` header, most often — context is the wrong place to look
 * when the root is inside: `useDocumentTokens` would answer with the package
 * defaults. So this reads the enclosing root's tokens when there is one, and
 * otherwise reads them off the element the way the page furniture does, with
 * the render's override as the last layer either way.
 */
export function useDocumentTokensAround(children: ReactNode): DocumentTokens {
  const inherited = useContext(DocumentTokensContext);
  const override = useTokenOverride();
  return useMemo(
    () => inherited ?? documentTokensOf(children, override),
    [inherited, children, override]
  );
}

/**
 * The token override a render supplied, if any.
 *
 * `Document` and `Bundle` read it as the last layer of their resolution, and
 * `Pages` and `Paper` read it to resolve the same paper the root will.
 */
export function useTokenOverride(): DocumentTokensInput | undefined {
  return useContext(TokenOverrideContext);
}

export interface TokenOverrideProviderProps {
  /** The tokens this render imposes on whatever document is below it. */
  tokens: DocumentTokensInput | undefined;
  children: ReactNode;
}

/**
 * Imposes one render's tokens on the document below it: the preview's
 * equivalent of `renderPdf(element, { tokens })`.
 *
 * Put it above the page furniture, so `Pages` and `Paper` resolve the same
 * paper the document root will. It is also honoured between the furniture and
 * the document, because the element walk recognises it.
 */
export function TokenOverrideProvider({ tokens, children }: TokenOverrideProviderProps) {
  return <TokenOverrideContext.Provider value={tokens}>{children}</TokenOverrideContext.Provider>;
}

(TokenOverrideProvider as TokenMarkers)[TOKEN_OVERRIDE] = true;

/** A nested document tried to change the paper or the typeface of its bundle. */
export class NestedPaperTokenError extends Error {
  /** The token it tried to set. */
  readonly token: string;

  constructor(token: string, value: unknown) {
    super(
      `A <Document> inside a <Bundle> set the token "${token}" to ${JSON.stringify(value)}. ` +
        "Paper, script, and rhythm are declared once, on the root: a bundle is one sequence of " +
        "pages laid out one way, and the page furniture and the PDF both read that one " +
        "declaration. Set it on the <Bundle> instead. A nested document may still set " +
        "accentColor and logo."
    );
    this.name = "NestedPaperTokenError";
    this.token = token;
  }
}

/**
 * A document root resolved a root-only token differently from whatever is
 * drawing it.
 *
 * Paper is the obvious case and the typeface is the dangerous one: a serif the
 * sheet never heard about produces a preview in the serif whose page plan was
 * measured in Inter, and a PDF byte-identical to the unbranded default with the
 * serif quietly dropped. Neither says anything without this.
 */
export class RootTokenMismatchError extends Error {
  /** The root-only token the two disagree about. */
  readonly token: string;

  constructor(token: string, resolved: unknown, drawn: unknown) {
    super(
      `The document resolved the root token "${token}" as ${JSON.stringify(resolved)}, but ` +
        `whatever is drawing it resolved ${JSON.stringify(drawn)}. The page furniture and ` +
        "`renderPdf` read a document's tokens off the element they are handed and never enter " +
        "a component, so a composition that sets its own tokens inside itself is invisible to " +
        "them. Accept `tokens` as a prop and pass it through, or put the <Bundle> or " +
        "<Document> directly under <Pages> or into the render call."
    );
    this.name = "RootTokenMismatchError";
    this.token = token;
  }
}

/**
 * What a document root resolved, and whether it is the root.
 *
 * A `Document` inside a `Bundle` inherits the bundle's set and is not the root.
 */
export interface ResolvedRoot {
  tokens: DocumentTokens;
  /** True when nothing above this component already resolved a token set. */
  isRoot: boolean;
}

/** Fails when a nested document sets a token only a root may set. */
function assertNestedTokens(own: DocumentTokensInput): void {
  for (const key of ROOT_ONLY_TOKEN_KEYS) {
    if (own[key] !== undefined) throw new NestedPaperTokenError(key, own[key]);
  }
}

/**
 * Resolves one document root's tokens, and checks the two rules.
 *
 * Nothing is published: whatever is drawing this document resolved the same
 * tokens from the same element before it rendered anything. What happens here
 * instead is the check that the two agree, which is the one place a composition
 * the element walk could not see through is caught.
 *
 * @throws {NestedPaperTokenError} when a nested document sets paper or typeface.
 * @throws {RootTokenMismatchError} when a root-only token is not the drawn one.
 */
export function useDocumentRootTokens(own: DocumentTokensInput | undefined): ResolvedRoot {
  const inherited = useContext(DocumentTokensContext);
  const override = useTokenOverride();
  const drawn = useDrawnPaper();

  const isRoot = inherited === null;
  if (!isRoot && own !== undefined) assertNestedTokens(own);

  const tokens = useMemo(
    () => resolveDocumentTokens(inherited ?? undefined, own, override),
    [inherited, own, override]
  );

  if (isRoot && drawn !== null) {
    const token = disagreeingRootToken(tokens, drawn.tokens);
    if (token !== undefined) {
      throw new RootTokenMismatchError(token, tokens[token], drawn.tokens[token]);
    }
  }

  return { tokens, isRoot };
}

export interface DocumentTokensProviderProps {
  tokens: DocumentTokens;
  children: ReactNode;
}

/** Supplies the resolved branding to everything below a document root. */
export function DocumentTokensProvider({ tokens, children }: DocumentTokensProviderProps) {
  return (
    <DocumentTokensContext.Provider value={tokens}>{children}</DocumentTokensContext.Provider>
  );
}

/** Marks a component as a place a token set may be declared. */
export function markDocumentRoot<T>(component: T): T {
  (component as TokenMarkers)[DOCUMENT_ROOT] = true;
  return component;
}
