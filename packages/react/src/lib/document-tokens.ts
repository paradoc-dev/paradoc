/**
 * The paper and the typeface, read off the element instead of out of a render.
 *
 * A document declares its branding at its root, and two things above that root
 * need to know the paper before the document renders: the page furniture, which
 * draws the sheet, and `renderPdf`, which puts the geometry in the prepared
 * input and reads the font files off disk. Neither can be handed anything by a
 * descendant, and an answer that arrived after the first commit would draw one
 * frame on the wrong paper, render the wrong paper in a static render, and be
 * unsound under concurrent rendering besides.
 *
 * So the answer is read the only way that is synchronous, pure and top-down:
 * from the element itself. A React element is a plain object, and the tokens are
 * one of its props. `documentTokensOf` walks the element it is given — through
 * fragments, arrays and host elements — and stops at the first element that
 * declares tokens.
 *
 * **What counts as a document root.** `Document`, `Bundle`, and composition
 * wrappers explicitly registered with `markDocumentRoot`. A prop name is never
 * guessed to carry document settings, so an unrelated design-system `tokens`
 * prop cannot silently change the paper. A custom wrapper accepts `tokens`,
 * forwards them, and registers its component function once.
 *
 * **The walk never calls a component.** It walks the children a component was
 * *given*, which are already-built elements, and stops there. So a wrapper —
 * an error boundary, a `memo`, a provider of someone else's — is transparent,
 * and a component that ignores its children or renders a tree of its own making
 * is not followed into. A composition that hardcodes its own `tokens` inside
 * itself is therefore invisible here, which is why `Document` and `Bundle`
 * compare what they resolved against what is drawing them and fail loudly when
 * the two differ, rather than letting the preview and the PDF drift apart in
 * silence.
 */

import { isValidElement, type ReactElement, type ReactNode } from "react";

import {
  resolveDocumentTokens,
  DOCUMENT_TOKEN_INPUT_KEYS,
  type DocumentTokens,
  type DocumentTokensInput,
} from "./tokens";

/** Marks `Document` and `Bundle` as places a token set may be declared. */
export const DOCUMENT_ROOT = Symbol.for("paradoc.react.documentRoot");

/** Marks `TokenOverrideProvider`, whose tokens are a layer rather than a root. */
export const TOKEN_OVERRIDE = Symbol.for("paradoc.react.tokenOverride");

/** What a marked component type carries. */
export interface TokenMarkers {
  [DOCUMENT_ROOT]?: true;
  [TOKEN_OVERRIDE]?: true;
}

/** More than one document root under one piece of page furniture. */
export class MultipleDocumentRootsError extends Error {
  /** How many roots were found. */
  readonly count: number;

  constructor(count: number) {
    super(
      `${count} document roots were handed to one preview. One sheet is drawn on one paper, ` +
        "so the furniture has to be able to name a single root: wrap the documents in a " +
        "<Bundle>, which is one root holding many documents, or give each its own <Pages>."
    );
    this.name = "MultipleDocumentRootsError";
    this.count = count;
  }
}

/** An element's props, as far as this walk cares. */
interface TokenProps {
  tokens?: unknown;
  children?: ReactNode;
}

function markers(element: ReactElement): TokenMarkers {
  return typeof element.type === "function" ? (element.type as TokenMarkers) : {};
}

/**
 * True when a `tokens` prop is shaped like a token set.
 *
 * A plain object whose every own key is one this package defines. It is a
 * discriminator, not a validation: a value that passes is resolved and
 * validated properly by `resolveDocumentTokens`, which is where a wrong value
 * gets a message naming the token.
 */
function isTokenInput(value: unknown): value is DocumentTokensInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.keys(value).every((key) =>
    (DOCUMENT_TOKEN_INPUT_KEYS as readonly string[]).includes(key)
  );
}

/** One root the walk found, with the overrides that were on its own branch. */
interface FoundRoot {
  tokens: DocumentTokensInput | undefined;
  /** The innermost override above this root, matching what context would give it. */
  override: DocumentTokensInput | undefined;
  overridden: boolean;
}

/**
 * Walks one branch, carrying the override in force on it.
 *
 * The override travels down rather than being collected globally, because a
 * provider on a branch that holds no document root is a provider over nothing:
 * recording it would brand a root it does not contain.
 */
function walk(node: ReactNode, branch: FoundRoot, roots: FoundRoot[]): void {
  if (node === null || node === undefined || typeof node !== "object") return;

  if (Array.isArray(node)) {
    for (const child of node) walk(child as ReactNode, branch, roots);
    return;
  }

  if (!isValidElement(node)) return;
  const element = node;
  const props = (element.props ?? {}) as TokenProps;
  const mark = markers(element);

  if (mark[TOKEN_OVERRIDE] === true) {
    // Innermost wins, as the context it stands in for would.
    const inner: FoundRoot = {
      tokens: undefined,
      override: isTokenInput(props.tokens) ? props.tokens : undefined,
      overridden: true,
    };
    walk(props.children, inner, roots);
    return;
  }

  if (mark[DOCUMENT_ROOT] === true) {
    roots.push({ ...branch, tokens: isTokenInput(props.tokens) ? props.tokens : undefined });
    return;
  }

  // The children a component was given are already-built elements, so walking
  // them calls nothing. What is never followed is what a component *renders*.
  walk(props.children, branch, roots);
}

/**
 * The token set the document below `element` declares, with `override` applied.
 *
 * Pure and synchronous: the same function answers for the preview's sheet and
 * for `renderPdf`, so the two cannot reach different papers.
 *
 * @throws {MultipleDocumentRootsError} when the element holds more than one root.
 * @throws {InvalidDocumentTokenError} when a declared value is one no renderer can act on.
 * @throws {UnregisteredFontFamilyError} when it names a family with no files.
 */
export function documentTokensOf(
  element: ReactNode,
  override?: DocumentTokensInput
): DocumentTokens {
  const root = onlyRoot(element);
  return resolveDocumentTokens(
    root?.tokens,
    root?.overridden === true ? root.override : override
  );
}

/**
 * The root the element declares, or `undefined` when it declares none.
 *
 * @throws {MultipleDocumentRootsError} when the element holds more than one.
 */
function onlyRoot(element: ReactNode): FoundRoot | undefined {
  const roots: FoundRoot[] = [];
  walk(element, { tokens: undefined, override: undefined, overridden: false }, roots);
  if (roots.length > 1) throw new MultipleDocumentRootsError(roots.length);
  return roots[0];
}
