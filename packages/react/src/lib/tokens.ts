/**
 * Tenant branding, as the smallest set of values that changes a document.
 *
 * The token set carries document metadata and paper/brand values that are not
 * ordinary application CSS. Applications own typography through their normal
 * stylesheet and font-loading pipeline.
 *
 * **Resolution is layered and total.** A caller supplies a partial set; what
 * comes out is complete, validated, and directly usable by either side.
 * `pageSize` becomes geometry both outputs measure against and `logo` bytes
 * become the one image source neither side has to fetch.
 *
 * **Every token is checked here, before an adapter sees it.** A colour no
 * renderer parses, a page size that arrived from a database as a string, a
 * margin wider than the page: each fails naming the token. An engine given a
 * value it cannot read drops the declaration silently, which is the loss this
 * package exists to rule out.
 *
 * **The script is a token too.** Which language a document is written in and
 * which way its lines run are not styling, but they are exactly what the
 * tokens are for: values both outputs have to resolve identically before
 * either draws, whose disagreement is invisible in each output on its own. A
 * page laid out left to right in the browser and right to left on paper is two
 * documents.
 *
 * **The defaults are today's document.** A document that names no tokens
 * renders exactly what it rendered before there were tokens: US Letter at 96
 * dpi with a 48 pixel margin, no accent, no mark, English left to right.
 */

import { imageDataUri } from "./image";
import {
  isTextDirection,
  DEFAULT_DOCUMENT_LANG,
  DEFAULT_TEXT_DIRECTION,
  type TextDirection,
} from "./script";

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
  /**
   * Which way the document's lines run, as HTML's `dir` means it. `rtl` puts
   * the start of every line and the first column of every row on the right.
   * An adapter that cannot lay the direction out fails naming itself.
   */
  dir?: TextDirection;
  /**
   * BCP-47 language tag, as HTML's `lang` means it. It decides the script the
   * document is written in, which the typeface has to carry glyphs for.
   */
  lang?: string;
}

/** One document's branding, complete. */
export interface DocumentTokens {
  /** The accent, or `undefined` when the document keeps its neutral palette. */
  accentColor?: string;
  /** The paper. */
  pageSize: PageSize;
  /** The margin on all four sides of every page. */
  marginPx: number;
  /** The organization's mark, as a source both outputs can read. */
  logo?: string;
  /** Which way the document's lines run. */
  dir: TextDirection;
  /** The language the document is written in. */
  lang: string;
}

/**
 * Every field of a resolved set, listed once.
 *
 * `satisfies` makes the list exhaustive: a token added to `DocumentTokens` and
 * not added here fails to compile, so nothing that compares or copies a token
 * set can quietly stop covering one.
 */
const DOCUMENT_TOKEN_FIELDS = {
  accentColor: true,
  pageSize: true,
  marginPx: true,
  logo: true,
  dir: true,
  lang: true,
} satisfies Record<keyof DocumentTokens, true>;

/** The field names, for anything that walks a resolved set. */
export const DOCUMENT_TOKEN_KEYS = Object.keys(DOCUMENT_TOKEN_FIELDS) as (keyof DocumentTokens)[];

/**
 * The names a caller may set, listed the same exhaustive way.
 *
 * Kept separate from the resolved list so additions remain exhaustively typed.
 */
const DOCUMENT_TOKEN_INPUT_FIELDS = {
  accentColor: true,
  pageSize: true,
  marginPx: true,
  logo: true,
  dir: true,
  lang: true,
} satisfies Record<keyof DocumentTokensInput, true>;

/** The settable names, for anything that has to recognise a token set. */
export const DOCUMENT_TOKEN_INPUT_KEYS = Object.keys(
  DOCUMENT_TOKEN_INPUT_FIELDS
) as (keyof DocumentTokensInput)[];

/**
 * The tokens that describe the paper and the script.
 *
 * They are the ones both outputs have to agree on, which is why only a document
 * root may set them: see `useDocumentRootTokens`. Direction and language belong
 * here because a bundle is one sequence of pages
 * running one way, and the loss when the two sides disagree is invisible in
 * either of them alone.
 */
export const ROOT_ONLY_TOKEN_KEYS = ["pageSize", "marginPx", "dir", "lang"] as const;

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
  pageSize: "letter",
  marginPx: DEFAULT_PAGE_MARGIN_PX,
  dir: DEFAULT_TEXT_DIRECTION,
  lang: DEFAULT_DOCUMENT_LANG,
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

  if (!isTextDirection(tokens.dir)) {
    throw new InvalidDocumentTokenError(
      "dir",
      tokens.dir,
      'is not "ltr" or "rtl", which are the directions HTML admits and the only two an ' +
        "adapter declares"
    );
  }

  try {
    new Intl.Locale(tokens.lang);
  } catch {
    throw new InvalidDocumentTokenError(
      "lang",
      tokens.lang,
      "is not a BCP-47 language tag: the script the document is written in is read from it, " +
        "and a tag nothing can parse names no script"
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
 * @throws {UndecodableImageError} when logo bytes are not an image.
 * @throws {InvalidDocumentTokenError} when a value is one no renderer can act on.
 */
export function resolveDocumentTokens(
  ...layers: readonly (DocumentTokensInput | undefined)[]
): DocumentTokens {
  let resolved: DocumentTokens = DEFAULT_DOCUMENT_TOKENS;

  for (const layer of layers) {
    if (layer === undefined) continue;
    resolved = {
      accentColor: layer.accentColor ?? resolved.accentColor,
      pageSize: layer.pageSize ?? resolved.pageSize,
      marginPx: layer.marginPx ?? resolved.marginPx,
      logo: resolveLogo(layer.logo) ?? resolved.logo,
      dir: layer.dir ?? resolved.dir,
      lang: layer.lang ?? resolved.lang,
    };
  }

  return assertValidTokens(resolved);
}

/**
 * The `dir` and `lang` attributes a resolved set puts on the document root,
 * when they are not the ones both outputs already apply.
 *
 * A document that never asked about its script is left alone: HTML's initial
 * direction is `ltr`, the Chromium adapter writes the language on `<html>`
 * anyway, and stamping the defaults onto every root would change the node tree
 * and the bytes of every rendered PDF to say what they already said.
 */
export function localeAttributes(tokens: DocumentTokens): { dir?: TextDirection; lang?: string } {
  return {
    ...(tokens.dir === DEFAULT_TEXT_DIRECTION ? {} : { dir: tokens.dir }),
    ...(tokens.lang === DEFAULT_DOCUMENT_LANG ? {} : { lang: tokens.lang }),
  };
}

/** True when two resolved sets describe the same document. */
export function sameDocumentTokens(a: DocumentTokens, b: DocumentTokens): boolean {
  return DOCUMENT_TOKEN_KEYS.every((key) => a[key] === b[key]);
}

/**
 * The first root-only token two resolved sets disagree about, or `undefined`.
 *
 * One helper, used by everything that has to decide whether two resolutions
 * describe the same document.
 */
export function disagreeingRootToken(
  a: DocumentTokens,
  b: DocumentTokens
): (typeof ROOT_ONLY_TOKEN_KEYS)[number] | undefined {
  return ROOT_ONLY_TOKEN_KEYS.find((key) => a[key] !== b[key]);
}
