/**
 * Tenant branding, as the smallest set of values that changes a document.
 *
 * The specification calls for one minimal token set — typeface, accent colour,
 * paper, mark — and for it to apply identically in the preview and in the PDF.
 * That is the whole reason the tokens are values rather than CSS: the browser
 * reaches a typeface through a stylesheet and an engine reaches it through a
 * font registry, and the only way the two cannot disagree is for both to be
 * driven from one resolved set.
 *
 * **Resolution is layered and total.** A caller supplies a partial set; what
 * comes out is complete, validated, and directly usable by either side.
 * `pageSize` becomes a geometry both outputs measure against, `fontFamily`
 * becomes a registered family with files, and `logo` bytes become the one image
 * source neither side has to fetch.
 *
 * **Every token is checked here, before an adapter sees it.** A colour no
 * renderer parses, a page size that arrived from a database as a string, a
 * margin wider than the page: each fails naming the token. An engine given a
 * value it cannot read drops the declaration silently, which is the loss this
 * package exists to rule out.
 *
 * **The defaults are today's document.** A document that names no tokens
 * renders exactly what it rendered before there were tokens: US Letter at 96
 * dpi with a 48 pixel margin, Inter, no accent, no mark.
 */

import type { CSSProperties } from "react";

import {
  documentFontFamily,
  DOCUMENT_FONT_NAME,
  type FontFamilyRegistration,
} from "./font";
import { imageDataUri } from "./image";

/** The papers a document may be laid out on. */
export type PageSize = "letter" | "a4";

/** Sheet dimensions in the CSS pixels both outputs state paper in. */
export interface PageDimensions {
  widthPx: number;
  heightPx: number;
}

/**
 * The papers, in CSS pixels at 96 dpi.
 *
 * A4 is 210 x 297 mm, which is 793.70 x 1122.52 pixels; both are rounded to
 * whole pixels because the preview lays out on a pixel grid and a fractional
 * sheet would put the two outputs a subpixel apart on every page. The rounding
 * is at most half a pixel, well under the parity suite's own drift limit.
 */
export const PAGE_SIZES: Record<PageSize, PageDimensions> = {
  letter: { widthPx: 816, heightPx: 1056 },
  a4: { widthPx: 794, heightPx: 1123 },
};

/** Page margin in CSS pixels, when the tokens name none. */
export const DEFAULT_PAGE_MARGIN_PX = 48;

/** What a caller may set. Anything omitted keeps the value it inherits. */
export interface DocumentTokensInput {
  /** A family registered in `src/lib/font.ts`. Naming another one fails. */
  fontFamily?: string;
  /**
   * The colour section headings and the emphasised total are drawn in. A hex
   * triplet, a CSS colour function, or a named CSS colour; anything else fails.
   * Omitted, the document keeps its neutral palette.
   */
  accentColor?: string;
  /** The paper. */
  pageSize?: PageSize;
  /** The margin on all four sides of every page, in CSS pixels. */
  marginPx?: number;
  /**
   * The organization's mark. Bytes are encoded as a `data:` URI, which is the
   * one image source neither the browser nor an engine has to fetch; a string
   * is used as it stands, so a URL the browser can reach is also accepted.
   *
   * **Keep it small: a mark, not a photograph.** Bytes are base 64 encoded,
   * which grows them by a third, and the result is inlined into the preview's
   * DOM and into every render of the document. Under 64 KB is comfortable;
   * anything approaching a megabyte belongs behind a URL instead.
   */
  logo?: Uint8Array | string;
}

/** One document's branding, complete. */
export interface DocumentTokens {
  /** The registered family both outputs embed. */
  fontFamily: string;
  /** The CSS stack the browser applies, from the family's registration. */
  fontStack: string;
  /** The accent, or `undefined` when the document keeps its neutral palette. */
  accentColor?: string;
  /** The paper. */
  pageSize: PageSize;
  /** The margin on all four sides of every page. */
  marginPx: number;
  /** The organization's mark, as a source both outputs can read. */
  logo?: string;
}

/**
 * Every field of a resolved set, listed once.
 *
 * `satisfies` makes the list exhaustive: a token added to `DocumentTokens` and
 * not added here fails to compile, so nothing that compares or copies a token
 * set can quietly stop covering one.
 */
const DOCUMENT_TOKEN_FIELDS = {
  fontFamily: true,
  fontStack: true,
  accentColor: true,
  pageSize: true,
  marginPx: true,
  logo: true,
} satisfies Record<keyof DocumentTokens, true>;

/** The field names, for anything that walks a resolved set. */
export const DOCUMENT_TOKEN_KEYS = Object.keys(DOCUMENT_TOKEN_FIELDS) as (keyof DocumentTokens)[];

/**
 * The names a caller may set, listed the same exhaustive way.
 *
 * `fontStack` is not among them: it is derived from `fontFamily` rather than
 * supplied, which is why the input type and the resolved type do not share a
 * key list.
 */
const DOCUMENT_TOKEN_INPUT_FIELDS = {
  fontFamily: true,
  accentColor: true,
  pageSize: true,
  marginPx: true,
  logo: true,
} satisfies Record<keyof DocumentTokensInput, true>;

/** The settable names, for anything that has to recognise a token set. */
export const DOCUMENT_TOKEN_INPUT_KEYS = Object.keys(
  DOCUMENT_TOKEN_INPUT_FIELDS
) as (keyof DocumentTokensInput)[];

/**
 * The tokens that describe the paper and the typeface.
 *
 * They are the ones both outputs have to agree on, which is why only a document
 * root may set them: see `useDocumentRootTokens`.
 */
export const ROOT_ONLY_TOKEN_KEYS = ["fontFamily", "pageSize", "marginPx"] as const;

/** A token whose value a renderer could not act on. */
export class InvalidDocumentTokenError extends Error {
  /** The token that was wrong. */
  readonly token: string;
  /** The value it was given. */
  readonly value: unknown;

  constructor(token: string, value: unknown, requirement: string) {
    super(
      `The document token "${token}" was given ${JSON.stringify(value)}, which ${requirement}. ` +
        "It is checked here rather than in a renderer because an engine given a value it " +
        "cannot read drops the declaration without saying so."
    );
    this.name = "InvalidDocumentTokenError";
    this.token = token;
    this.value = value;
  }
}

/** The document as it renders when nothing is branded. */
export const DEFAULT_DOCUMENT_TOKENS: DocumentTokens = {
  fontFamily: DOCUMENT_FONT_NAME,
  fontStack: documentFontFamily(DOCUMENT_FONT_NAME).stack,
  pageSize: "letter",
  marginPx: DEFAULT_PAGE_MARGIN_PX,
};

/** The sheet and the box inside it, in the CSS pixels both outputs share. */
export interface PageGeometry extends PageDimensions {
  /** Margin on all four sides of every page. */
  marginPx: number;
  /** Height available on one page, once both margins are taken. */
  contentHeightPx: number;
  /** Width available on one page, once both margins are taken. */
  contentWidthPx: number;
}

/** The paper one token set describes. */
export function pageGeometry(tokens: DocumentTokens): PageGeometry {
  const { widthPx, heightPx } = PAGE_SIZES[tokens.pageSize];
  return {
    widthPx,
    heightPx,
    marginPx: tokens.marginPx,
    contentHeightPx: heightPx - tokens.marginPx * 2,
    contentWidthPx: widthPx - tokens.marginPx * 2,
  };
}

/** The registration of the family a resolved token set names. */
export function tokenFontFamily(tokens: DocumentTokens): FontFamilyRegistration {
  return documentFontFamily(tokens.fontFamily);
}

/**
 * The mark as an image source, or `undefined` when the tokens carry none.
 *
 * Encoded bytes are cached against the array they came from, because a token
 * set is resolved on every render of a document root and base 64 of a mark is
 * not free. The cache is weak, so it holds nothing the caller has let go.
 */
const logoUris = new WeakMap<Uint8Array, string>();

function resolveLogo(logo: Uint8Array | string | undefined): string | undefined {
  if (logo === undefined) return undefined;
  if (typeof logo === "string") return logo;
  const cached = logoUris.get(logo);
  if (cached !== undefined) return cached;
  const uri = imageDataUri(logo, "logo");
  logoUris.set(logo, uri);
  return uri;
}

/** CSS colour function notations any renderer here is expected to parse. */
const COLOR_FUNCTIONS =
  /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\([^()]*(?:\([^()]*\)[^()]*)*\)$/iu;

/** `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`. */
const COLOR_HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/iu;

/**
 * The CSS named colours, plus the two keywords that behave like one.
 *
 * Listed rather than pattern-matched because "not-a-colour" and "rebeccapurple"
 * are the same shape, and the point of the check is telling them apart.
 */
const COLOR_NAMES = new Set(
  (
    "transparent currentcolor aliceblue antiquewhite aqua aquamarine azure beige bisque black " +
    "blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral " +
    "cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen " +
    "darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon " +
    "darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink " +
    "deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro " +
    "ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo " +
    "ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan " +
    "lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen " +
    "lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen " +
    "magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen " +
    "mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream " +
    "mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid " +
    "palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum " +
    "powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown " +
    "seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen " +
    "steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen"
  ).split(" ")
);

/** True when `value` is a colour a renderer can be expected to parse. */
export function isCssColor(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  return (
    COLOR_HEX.test(trimmed) ||
    COLOR_FUNCTIONS.test(trimmed) ||
    COLOR_NAMES.has(trimmed.toLowerCase())
  );
}

/**
 * Checks a resolved set, and returns it.
 *
 * The margin is checked against the page it is on rather than against a fixed
 * number, because a margin that leaves no content box is a different mistake on
 * A4 than on US Letter and only the page knows which.
 *
 * @throws {InvalidDocumentTokenError} naming the token that is wrong.
 */
function assertValidTokens(tokens: DocumentTokens): DocumentTokens {
  const paper = PAGE_SIZES[tokens.pageSize] as PageDimensions | undefined;
  if (paper === undefined) {
    throw new InvalidDocumentTokenError(
      "pageSize",
      tokens.pageSize,
      `is not one of ${Object.keys(PAGE_SIZES).join(", ")}`
    );
  }

  if (tokens.accentColor !== undefined && !isCssColor(tokens.accentColor)) {
    throw new InvalidDocumentTokenError(
      "accentColor",
      tokens.accentColor,
      "is not a CSS colour: give a hex triplet, a colour function, or a named CSS colour"
    );
  }

  const shortSide = Math.min(paper.widthPx, paper.heightPx);
  if (!Number.isInteger(tokens.marginPx) || tokens.marginPx < 0) {
    throw new InvalidDocumentTokenError(
      "marginPx",
      tokens.marginPx,
      "is not a whole number of CSS pixels at or above zero"
    );
  }
  if (tokens.marginPx * 2 >= shortSide) {
    throw new InvalidDocumentTokenError(
      "marginPx",
      tokens.marginPx,
      `leaves no content box on ${tokens.pageSize}, whose short side is ${shortSide} px: ` +
        `two margins have to be under that`
    );
  }

  return tokens;
}

/**
 * Completes a token set from the ones it inherits.
 *
 * Layers rather than a single merge, because a token set arrives in up to four
 * pieces: the package's defaults, the set a bundle put on every document in it,
 * the set the document names for itself, and the set the render overrides for
 * one tenant. Later layers win field by field, so a render that changes only
 * the accent keeps the paper the document chose.
 *
 * @throws {UnregisteredFontFamilyError} when a layer names a family with no files.
 * @throws {UndecodableImageError} when logo bytes are not an image.
 * @throws {InvalidDocumentTokenError} when a value is one no renderer can act on.
 */
export function resolveDocumentTokens(
  ...layers: readonly (DocumentTokensInput | undefined)[]
): DocumentTokens {
  let resolved: DocumentTokens = DEFAULT_DOCUMENT_TOKENS;

  for (const layer of layers) {
    if (layer === undefined) continue;
    const family = layer.fontFamily === undefined ? undefined : documentFontFamily(layer.fontFamily);
    resolved = {
      fontFamily: family?.name ?? resolved.fontFamily,
      fontStack: family?.stack ?? resolved.fontStack,
      accentColor: layer.accentColor ?? resolved.accentColor,
      pageSize: layer.pageSize ?? resolved.pageSize,
      marginPx: layer.marginPx ?? resolved.marginPx,
      logo: resolveLogo(layer.logo) ?? resolved.logo,
    };
  }

  return assertValidTokens(resolved);
}

/**
 * The CSS custom property the sheet's typeface is read from.
 *
 * `styles.css` states `font-family: var(--paradoc-font-family, <Inter stack>)`,
 * so a document that names no family is styled by the stylesheet alone and one
 * that names a family sets the property on its own root. The PDF reaches the
 * same family through the engine's font registry rather than through CSS, which
 * is why the property is the browser's half of one token rather than the token
 * itself.
 */
export const FONT_FAMILY_PROPERTY = "--paradoc-font-family";

/**
 * The style that puts a resolved token set's typeface within reach of the
 * browser. A custom property is not a `CSSProperties` key, so the cast is where
 * that one fact is stated rather than at each of the elements that carry it.
 */
export function fontFamilyStyle(tokens: DocumentTokens): CSSProperties {
  return { [FONT_FAMILY_PROPERTY]: tokens.fontStack } as CSSProperties;
}

/** True when two resolved sets describe the same document. */
export function sameDocumentTokens(a: DocumentTokens, b: DocumentTokens): boolean {
  return DOCUMENT_TOKEN_KEYS.every((key) => a[key] === b[key]);
}

/**
 * The first root-only token two resolved sets disagree about, or `undefined`.
 *
 * One helper, used by everything that has to decide whether two resolutions
 * describe the same document: a paper comparison alone would let a typeface
 * through, and the typeface is exactly the token whose loss is invisible — a
 * PDF with the serif dropped is byte-identical to one that never asked for it.
 */
export function disagreeingRootToken(
  a: DocumentTokens,
  b: DocumentTokens
): (typeof ROOT_ONLY_TOKEN_KEYS)[number] | undefined {
  return ROOT_ONLY_TOKEN_KEYS.find((key) => a[key] !== b[key]);
}
