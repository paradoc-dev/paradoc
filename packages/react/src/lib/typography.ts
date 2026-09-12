/**
 * A document's rhythm: how large its text is and how far apart its blocks sit.
 *
 * Fonts are not here. An application owns its typefaces through its own
 * stylesheet, and a document inherits them. What a composition could not say
 * in one place until now is the *size* of things: a compact invoice that has
 * to fit, a roomy letter that should breathe. Those decisions were written
 * into every installed component as a fixed class, thirteen files apart.
 *
 * **Two knobs, three levels each.** `scale` moves every text role the
 * components set a size for, and its leading with it; `flow` moves the space
 * between blocks at the document root. Each is `compact`, `regular`, or
 * `roomy`, and `regular` is today's document by definition: a root that names
 * no rhythm renders byte for byte what it rendered before there was one.
 *
 * **A level is one step, not a number.** The default PDF engine draws from a
 * verified vocabulary of Tailwind classes and nothing else, and it has no
 * evidence of honouring a custom property or an arbitrary value. So a level is
 * defined as one step along that vocabulary's own scales, and the helpers here
 * rewrite a class string rather than emit a value: `text-sm leading-relaxed`
 * becomes `text-xs leading-snug` at `compact` and `text-base leading-loose` at
 * `roomy`. Every size, leading, and gap form the vocabulary verifies is
 * stepped, so a composition written inside that vocabulary moves as one; the
 * ends of each scale are the floor and the ceiling, so a role already at
 * `text-xs` stays there when the document goes compact, and every class a
 * level produces is one the engine already accepts.
 *
 * **An explicit class wins.** The helpers only rewrite what they are given. A
 * component that is handed a `className` uses it as written. In an installed
 * component the role's literal is passed through `scaleTextClasses`, and that
 * call is the opt-in: a copy owner pins a role by writing its class directly
 * instead of through the helper, and the rest of the document still follows
 * the tokens while that role does not.
 */

/** The levels, in order, so a step has a direction. */
export const TYPOGRAPHY_LEVELS = ["compact", "regular", "roomy"] as const;

/** How far a document's rhythm sits from today's. */
export type TypographyLevel = (typeof TYPOGRAPHY_LEVELS)[number];

/** What a caller may set. Either knob may be named alone. */
export interface TypographyInput {
  /** The size of every text role, with its leading. */
  scale?: TypographyLevel;
  /** The space between blocks at the document root. */
  flow?: TypographyLevel;
}

/** One document's rhythm, complete. */
export interface Typography {
  scale: TypographyLevel;
  flow: TypographyLevel;
}

/** Today's document. */
export const DEFAULT_TYPOGRAPHY: Typography = { scale: "regular", flow: "regular" };

/** The knobs, listed once so validation cannot skip one. */
export const TYPOGRAPHY_KEYS = ["scale", "flow"] as const;

/** True when `value` names a level. */
export function isTypographyLevel(value: unknown): value is TypographyLevel {
  return typeof value === "string" && (TYPOGRAPHY_LEVELS as readonly string[]).includes(value);
}

/** True when two resolved rhythms describe the same document. */
export function sameTypography(a: Typography, b: Typography): boolean {
  return a.scale === b.scale && a.flow === b.flow;
}

/** How many steps a level is from `regular`: -1, 0, or +1. */
function stepOf(level: TypographyLevel): number {
  return TYPOGRAPHY_LEVELS.indexOf(level) - TYPOGRAPHY_LEVELS.indexOf("regular");
}

/**
 * The verified size scale, smallest first: every `text-<size>` the engine's
 * vocabulary names, in the order Tailwind defines them.
 */
const TEXT_SIZES = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl"] as const;

/**
 * The named leadings, tightest first: every `leading-<name>` the vocabulary
 * verifies. `normal` is not among them, which is why a step from `relaxed`
 * lands on `snug` rather than a sixteenth of an em away.
 */
const LEADINGS = ["none", "tight", "snug", "relaxed", "loose"] as const;

/**
 * The spacing scale's bounds, in the quarter-rem units Tailwind counts in.
 *
 * The vocabulary admits up to three digits with an optional half, so the
 * ceiling is the largest such value and the floor is zero.
 */
const SPACING_MAX = 999.5;

/**
 * How far one step moves a gap, in spacing units.
 *
 * Two, because that is the difference between the root's own `gap-6` and the
 * next gap a reader notices; one unit at this size is under a quarter of a
 * line and reads as nothing.
 */
const GAP_STEP = 2;

function stepAlong<T extends string>(scale: readonly T[], current: T, steps: number): T {
  const index = scale.indexOf(current);
  if (index < 0) return current;
  const next = Math.min(scale.length - 1, Math.max(0, index + steps));
  return scale[next] as T;
}

/** A spacing value stepped and clamped to the vocabulary's own bounds. */
function stepSpacing(value: string, steps: number): string {
  const next = Math.min(SPACING_MAX, Math.max(0, Number(value) + steps));
  return String(next);
}

const TEXT_SIZE_CLASS = /^text-(xs|sm|base|lg|xl|[2-9]xl)$/u;
const NAMED_LEADING_CLASS = /^leading-(none|tight|snug|relaxed|loose)$/u;
const SPACING_LEADING_CLASS = /^leading-(\d{1,3}(?:\.5)?)$/u;
const GAP_CLASS = /^(gap(?:-[xy])?)-(\d{1,3}(?:\.5)?)$/u;

/** Applies `rewrite` to each class in `classes`, preserving order. */
function rewriteClasses(classes: string, rewrite: (name: string) => string): string {
  return classes
    .split(/\s+/u)
    .filter((name) => name.length > 0)
    .map(rewrite)
    .join(" ");
}

/**
 * Rewrites the text size and leading classes in `classes` one step for
 * `scale`, leaving every other class as it was.
 *
 * A named size or leading steps along its scale; a spacing leading such as
 * `leading-6` steps one spacing unit. `regular` returns the string unchanged,
 * so a document that names no rhythm renders the classes its components
 * always had.
 */
export function scaleTextClasses(classes: string, scale: TypographyLevel): string {
  const steps = stepOf(scale);
  if (steps === 0) return classes;
  return rewriteClasses(classes, (name) => {
    const size = TEXT_SIZE_CLASS.exec(name);
    if (size) return `text-${stepAlong(TEXT_SIZES, size[1] as (typeof TEXT_SIZES)[number], steps)}`;
    const leading = NAMED_LEADING_CLASS.exec(name);
    if (leading) {
      return `leading-${stepAlong(LEADINGS, leading[1] as (typeof LEADINGS)[number], steps)}`;
    }
    const spacing = SPACING_LEADING_CLASS.exec(name);
    if (spacing) return `leading-${stepSpacing(spacing[1] as string, steps)}`;
    return name;
  });
}

/**
 * Rewrites the gap classes in `classes` one step for `flow`, leaving every
 * other class as it was.
 *
 * `gap-*`, `gap-x-*`, and `gap-y-*` each move two spacing units per step,
 * clamped to the vocabulary's bounds; `gap-px` has no place on the scale and
 * is left alone. `regular` returns the string unchanged.
 */
export function flowGapClasses(classes: string, flow: TypographyLevel): string {
  const steps = stepOf(flow);
  if (steps === 0) return classes;
  return rewriteClasses(classes, (name) => {
    const gap = GAP_CLASS.exec(name);
    if (!gap) return name;
    return `${gap[1]}-${stepSpacing(gap[2] as string, steps * GAP_STEP)}`;
  });
}
