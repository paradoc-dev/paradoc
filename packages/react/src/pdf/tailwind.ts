/**
 * The Tailwind vocabulary the PDF path accepts.
 *
 * The preview runs in a browser, which understands every Tailwind utility. The
 * engine understands a subset, and it says nothing when it meets a class it
 * cannot express: the declaration is dropped and the page comes out subtly
 * wrong. The specification's rule is that nothing degrades silently, so the PDF
 * path checks every class against this list first and refuses to render when it
 * finds one it has not verified.
 *
 * **Every family here is proved, not assumed.** Each carries a representative
 * class and the fragment that makes it observable, and
 * `tests/pdf-class-support.test.tsx` renders that fragment with and without the
 * class and fails if the PDF bytes are identical. The list therefore cannot
 * drift away from the engine: a family the engine stops honouring fails the
 * suite rather than degrading a document.
 *
 * A utility the engine may well support but the probe cannot show it honours is
 * outside the list and fails loudly. That is the right answer for a package whose
 * output is evidence. Text decoration (`underline`, `line-through`), border
 * styles (`border-dashed`), `order-*`, `align-*`, `break-inside-*` and
 * `break-before-*` as classes, `text-ellipsis`, `break-words`, `flex-none`,
 * `shrink-0` and `grow-0` all probed byte-identical against takumi-pdf 0.4.2 and
 * are excluded for that reason. The walk in `tree.ts` applies the page-break
 * intent as an inline style, which the engine does honour.
 *
 * The spacing, sizing and border-width scales are Tailwind v4's open numeric
 * scales rather than v3's fixed steps, because the engine honours `p-13`,
 * `p-104`, `gap-15` and `border-3`.
 */

/**
 * Tailwind v4's open spacing scale, shared by padding, margin, gap, sizing and
 * numeric line heights. Probed at `p-0.5`, `p-2.5`, `p-13`, `p-104` and `w-px`.
 */
const SPACING = String.raw`px|\d{1,3}(?:\.5)?`;

/** Fractional sizes, as `Table` uses for its column basis. */
const FRACTION = String.raw`\d{1,2}\/(?:2|3|4|5|6|12)`;

/** Everything `w-`, `h-`, `size-` and `basis-` accept. */
const SIZE = `${SPACING}|${FRACTION}|full|auto|screen`;

/**
 * Colour families the engine's palette carries. `taupe`, `mauve`, `mist` and
 * `olive` are takumi's own additions; the rest are Tailwind's.
 */
const PALETTE = [
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
  "taupe",
  "mauve",
  "mist",
  "olive",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
].join("|");

const COLOR = `black|white|transparent|(?:${PALETTE})-(?:50|100|200|300|400|500|600|700|800|900|950)`;

/**
 * Classes that are not Tailwind utilities and carry no layout of their own.
 * `paradoc-document` names the typeface for the browser; the PDF supplies the
 * same family through the renderer's font stack, so it is a no-op here rather
 * than a silent loss.
 */
const NON_UTILITY_CLASSES = new Set(["paradoc-document", "paradoc-ltr-isolate"]);

/** Which fragment makes a family's effect visible. */
export type ProbeHarness = "layout" | "narrow" | "text";

/** One verified family of utilities. */
export interface ClassFamily {
  /** What the family covers, for error messages and the README. */
  name: string;
  /** Which classes the family admits. */
  pattern: RegExp;
  /** A class from this family the support test renders with and without. */
  probe: string;
  /** The fragment that makes `probe` observable. */
  harness: ProbeHarness;
}

/** The verified vocabulary, by family. */
export const SUPPORTED_CLASS_FAMILIES: readonly ClassFamily[] = [
  {
    name: "display",
    pattern: /^(?:block|inline-block|inline|flex|hidden)$/,
    probe: "block",
    harness: "layout",
  },
  {
    name: "overflow",
    pattern: /^overflow(?:-[xy])?-(?:hidden|clip)$/,
    probe: "overflow-hidden",
    harness: "layout",
  },
  { name: "absolute positioning", pattern: /^absolute$/, probe: "absolute", harness: "layout" },

  {
    name: "flex direction",
    pattern: /^flex-(?:row|col)(?:-reverse)?$/,
    probe: "flex-col",
    harness: "layout",
  },
  {
    name: "flex wrapping",
    pattern: /^flex-(?:wrap|wrap-reverse|nowrap)$/,
    probe: "flex-wrap",
    harness: "narrow",
  },
  {
    name: "flex sizing",
    pattern: new RegExp(`^flex-(?:1|auto)$|^grow$|^basis-(?:${SIZE})$`),
    probe: "basis-1/2",
    harness: "layout",
  },
  {
    name: "alignment",
    pattern:
      /^items-(?:start|end|center|baseline|stretch)$|^self-(?:auto|start|end|center|baseline|stretch)$|^justify-(?:start|end|center|between|around|evenly)$/,
    probe: "items-center",
    harness: "layout",
  },
  {
    name: "gap",
    pattern: new RegExp(`^gap(?:-[xy])?-(?:${SPACING})$`),
    probe: "gap-4",
    harness: "layout",
  },

  {
    name: "padding",
    pattern: new RegExp(`^p[xytrbl]?-(?:${SPACING})$`),
    probe: "p-4",
    harness: "layout",
  },
  {
    name: "margin",
    pattern: new RegExp(`^-?m[xytrbl]?-(?:${SPACING}|auto)$`),
    probe: "m-4",
    harness: "layout",
  },
  {
    name: "sizing",
    pattern: new RegExp(`^(?:w|h|size)-(?:${SIZE})$|^(?:min|max)-[wh]-(?:${SIZE}|none)$`),
    probe: "w-1/2",
    harness: "layout",
  },

  {
    name: "border width",
    pattern: /^border(?:-[xytrbl])?(?:-\d{1,2})?$/,
    probe: "border-4",
    harness: "layout",
  },
  {
    name: "border colour",
    pattern: new RegExp(`^border(?:-[xytrbl])?-(?:${COLOR})$`),
    probe: "border-neutral-800",
    harness: "layout",
  },
  {
    name: "border radius",
    pattern:
      /^rounded(?:-(?:[trbl]|tl|tr|br|bl))?(?:-(?:none|xs|sm|md|lg|xl|2xl|3xl|4xl|full))?$/,
    probe: "rounded-lg",
    harness: "layout",
  },

  {
    name: "font size",
    pattern: /^text-(?:xs|sm|base|lg|xl|[2-9]xl)$/,
    probe: "text-lg",
    harness: "text",
  },
  {
    name: "font weight and style",
    pattern:
      /^font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$|^(?:italic|not-italic)$/,
    probe: "font-semibold",
    harness: "text",
  },
  {
    name: "line height",
    pattern: new RegExp(`^leading-(?:none|tight|snug|relaxed|loose|${SPACING})$`),
    probe: "leading-loose",
    harness: "text",
  },
  {
    name: "letter spacing",
    pattern: /^tracking-(?:tighter|tight|normal|wide|wider|widest)$/,
    probe: "tracking-wider",
    harness: "text",
  },
  {
    name: "text transform",
    pattern: /^(?:uppercase|lowercase|capitalize|normal-case)$/,
    probe: "uppercase",
    harness: "text",
  },
  {
    name: "text alignment",
    pattern: /^text-(?:left|center|right|justify|start|end)$/,
    probe: "text-right",
    harness: "text",
  },
  { name: "text truncation", pattern: /^truncate$/, probe: "truncate", harness: "text" },
  {
    name: "text colour",
    pattern: new RegExp(`^text-(?:${COLOR})$`),
    probe: "text-neutral-500",
    harness: "text",
  },
  {
    name: "background colour",
    pattern: new RegExp(`^bg-(?:${COLOR})$`),
    probe: "bg-white",
    harness: "layout",
  },
  { name: "opacity", pattern: /^opacity-(?:100|\d{1,2})$/, probe: "opacity-50", harness: "layout" },
  {
    name: "shadow",
    pattern: /^shadow(?:-(?:2xs|xs|sm|md|lg|xl|2xl|none))?$/,
    probe: "shadow-md",
    harness: "layout",
  },

  {
    name: "whitespace",
    pattern: /^whitespace-(?:normal|pre|pre-line|pre-wrap|nowrap)$/,
    probe: "whitespace-pre-line",
    harness: "text",
  },
  {
    name: "text wrapping",
    pattern: /^text-(?:wrap|nowrap|balance)$/,
    probe: "text-balance",
    harness: "text",
  },
];

/**
 * Classes whose value is the one the engine already applies, so the probe
 * cannot show an effect and there is nothing to lose. Admitting them is safe
 * precisely because they change neither output; the support test asserts that
 * by requiring each to render byte-identical.
 */
export const INITIAL_VALUE_CLASSES: readonly string[] = [
  "flex-row",
  "flex-nowrap",
  "items-stretch",
  "self-auto",
  "self-stretch",
  "justify-start",
  "gap-0",
  "p-0",
  "m-0",
  "max-w-none",
  "max-h-none",
  "rounded-none",
  "font-normal",
  "not-italic",
  "tracking-normal",
  "normal-case",
  "text-left",
  "text-start",
  "whitespace-normal",
  "text-wrap",
  "opacity-100",
  "shadow-none",
];

/** Splits a `className` or `tw` value into classes, dropping the whitespace. */
export function splitClasses(className: string): string[] {
  return className.split(/\s+/).filter((value) => value.length > 0);
}

/** True when the PDF path has verified this class against the engine. */
export function isSupportedClass(name: string): boolean {
  if (NON_UTILITY_CLASSES.has(name)) return true;
  return SUPPORTED_CLASS_FAMILIES.some((family) => family.pattern.test(name));
}

/** Every class in `className` the PDF path has not verified, in the order given. */
export function unsupportedClasses(className: string): string[] {
  return splitClasses(className).filter((name) => !isSupportedClass(name));
}
