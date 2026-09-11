/**
 * The one place the document tree is translated for the PDF engine.
 *
 * `@takumi-rs/helpers` resolves the React tree — components, contexts and the
 * hooks they use — into a plain node tree that still carries `className` and
 * the `data-*` attributes the components wrote. That is the only level at which
 * a walk is possible: above it the tree is function components that have not
 * run yet, below it the classes have already become styles.
 *
 * The walk does five things and nothing else:
 *
 * 1. Moves `className` to `tw`, which is the property the engine reads, after
 *    checking the combined value against the verified vocabulary. A node may
 *    already carry `tw` — the engine's own property — and that half is checked
 *    too, so writing `tw` directly cannot slip a class past the list.
 * 2. Gives every `[data-keep-id]` element `break-inside: avoid`, which is the
 *    same keep-together intent the preview's pagination rule states, and
 *    `break-before: page` for a keep the plan breaks on.
 * 3. Repeats a table header above a hinted keep when the plan says that page
 *    carries a copy, so a hinted page opens with the header the preview puts
 *    there.
 * 4. Collects the images the render needs bytes for, because the engine fetches
 *    nothing.
 * 5. Reads every text node and fails when the document is written in a script
 *    the family it is set in carries no glyphs for. This is the last place the
 *    document's *resolved* text exists before an engine sees it, which is what
 *    makes it the right place: a document that declares no language and is
 *    Arabic anyway reaches the engine as a page of null glyphs with no error at
 *    all, and neither its tokens nor its data would have said so.
 *
 * A repeated header is the one node the walk adds, and it is a translation of a
 * node that is already in the tree rather than new markup: the tree the PDF
 * renders is still the tree the preview renders, page for page.
 */

import type { CSSProperties } from "react";
import type { Node } from "@takumi-rs/helpers";

import type { PagePlan } from "../lib/plan";
import { unsupportedClasses } from "./tailwind";

/** The attribute that marks a pagination unit, shared with the preview. */
export const KEEP_ID_ATTRIBUTE = "data-keep-id";

/** The attribute that marks a copy rather than a keep's place in the flow. */
export const KEEP_REPEAT_ATTRIBUTE = "data-keep-repeat";

/**
 * The half of the preview's page plan the PDF engine can act on.
 *
 * Page starts and header copies travel together because they are one decision:
 * a caller that could hand over `breaks` alone would ask for a page that opens
 * on a continued row with no header above it, which is a page the preview never
 * drew.
 */
export type PageBreakPlan = Pick<PagePlan, "breaks" | "repeats" | "fonts">;

export interface PrepareOptions {
  /** The preview's page plan. Absent, the engine paginates on its own. */
  plan?: PageBreakPlan;
  /** `src` values the caller supplied bytes for. */
  imageSources?: Iterable<string>;
  /**
   * The registered family the document is set in. Given, every text node is
   * checked against the scripts it carries glyphs for; omitted, the walk makes
   * no claim about the text, which is what a caller translating a fragment
   * rather than a document wants.
   */
  /** The document's language, for the error to name. Defaults to `en`. */
  lang?: string;
}

export interface PreparedTree {
  /** The translated tree, ready for the engine. */
  node: Node;
  /** Classes outside the verified vocabulary, unique and in document order. */
  unsupportedClasses: string[];
  /** Image `src` values the caller supplied no bytes for, unique and in document order. */
  missingImages: string[];
  /** Planned breaks that matched a keep, in the order the keeps appear. */
  appliedBreaks: string[];
  /** Planned breaks naming a keep that is not in the tree. */
  unknownBreaks: string[];
  /** Planned header copies naming a keep that is not in the tree. */
  unknownRepeats: string[];
}

/** Appends `value` unless it is already there, so an offender is named once. */
export function recordOnce(into: string[], value: string): void {
  if (!into.includes(value)) into.push(value);
}

/** A `data:` URI carries its own bytes, so the caller owes nothing for it. */
function carriesOwnBytes(src: string): boolean {
  return src.startsWith("data:");
}

function keepId(node: Node): string | undefined {
  return node.attributes?.[KEEP_ID_ATTRIBUTE];
}

/** Every keep in the tree, by id, so a hint is resolved wherever it points. */
function indexKeeps(node: Node, into: Map<string, Node>): Map<string, Node> {
  const id = keepId(node);
  if (id !== undefined && !into.has(id)) into.set(id, node);
  if (node.type === "container" && node.children) {
    for (const child of node.children) indexKeeps(child, into);
  }
  return into;
}

/**
 * Which copies open the page a planned break starts.
 *
 * `breaks[i]` is the keep that starts page `i + 1`, and `repeats[i + 1]` is
 * what that page carries above it. The two come from one plan, so they are read
 * as one thing here rather than being reconciled by the caller.
 */
function repeatsByBreak(plan: PageBreakPlan | undefined): Map<string, readonly string[]> {
  const byBreak = new Map<string, readonly string[]>();
  (plan?.breaks ?? []).forEach((id, index) => {
    const copies = plan?.repeats[index + 1];
    if (copies && copies.length > 0) byBreak.set(id, copies);
  });
  return byBreak;
}

/**
 * Every keep id the plan copies onto a page.
 *
 * Read from the plan itself rather than from the breaks it could be paired
 * with, so a copy listed for a page no break opens is still reported when the
 * tree does not have it. Page 1 is skipped: nothing opens it, and the plan never
 * copies onto it.
 */
function plannedRepeats(plan: PageBreakPlan | undefined): string[] {
  const named: string[] = [];
  (plan?.repeats ?? []).forEach((copies, page) => {
    if (page === 0) return;
    for (const id of copies) recordOnce(named, id);
  });
  return named;
}

/** What one walk of a node knows about the walk above it. */
interface WalkContext {
  /** A header copy above this node already carries the page break. */
  breakTaken?: boolean;
  /**
   * This walk is producing a copy. A copy owns no hint: it neither takes a
   * page break from the plan nor reports one as applied, because the keep's
   * own place in the flow is walked separately and that walk is the one that
   * answers for it.
   */
  asCopy?: boolean;
}

/**
 * Translates a resolved node tree for the engine, collecting everything that
 * would otherwise be dropped in silence.
 */
export function preparePdfTree(root: Node, options: PrepareOptions = {}): PreparedTree {
  const breaks = new Set(options.plan?.breaks ?? []);
  const supplied = new Set(options.imageSources ?? []);
  const repeats = repeatsByBreak(options.plan);
  const keeps = indexKeeps(root, new Map<string, Node>());

  const offendingClasses: string[] = [];
  const missing: string[] = [];
  const applied: string[] = [];
  const text: string[] = [];

  const walk = (node: Node, context: WalkContext = {}): Node => {
    const { className, ...rest } = node;
    const translated: Node = { ...rest };

    // `tw` and `className` are two spellings of the same thing to the engine.
    // Both are checked, and both end up in `tw`.
    const classes = [translated.tw, className].filter(Boolean).join(" ");
    if (classes) {
      for (const name of unsupportedClasses(classes)) recordOnce(offendingClasses, name);
      translated.tw = classes;
    }

    const id = keepId(node);
    if (id !== undefined) {
      // A keep is a pagination unit in both outputs. The preview refuses to
      // split it; the engine is told the same thing in its own vocabulary.
      const pagination: CSSProperties = { breakInside: "avoid" };
      if (!context.asCopy && breaks.has(id)) {
        recordOnce(applied, id);
        // A header copy above this keep already carries the break, and two
        // breaks in a row would leave the copy alone on a page of its own.
        if (!context.breakTaken) pagination.breakBefore = "page";
      }
      // Inline style wins over `tw` in the engine, so the intent cannot be
      // overridden by a class the document happens to carry.
      translated.style = { ...translated.style, ...pagination };
    }

    if (translated.type === "text") text.push(translated.text);

    if (translated.type === "image") {
      const { src } = translated;
      if (typeof src === "string" && !carriesOwnBytes(src) && !supplied.has(src)) {
        recordOnce(missing, src);
      }
    }

    if (translated.type === "container" && translated.children) {
      const children: Node[] = [];
      for (const child of translated.children) {
        const childId = keepId(child);
        const copies = childId === undefined ? [] : (repeats.get(childId) ?? []);
        // The copy is a sibling of the keep it opens the page for, which is
        // where the header already sits: a header and its rows share a parent.
        let taken = false;
        for (const copyId of copies) {
          const source = keeps.get(copyId);
          if (source === undefined) continue;
          const opensPage: boolean = !taken && childId !== undefined && breaks.has(childId);
          children.push(headerCopy(walk(source, { asCopy: true }), opensPage));
          taken ||= opensPage;
        }
        children.push(walk(child, { breakTaken: taken, asCopy: context.asCopy }));
      }
      translated.children = children;
    }

    return translated;
  };

  const node = walk(root);

  // After the walk rather than during it, so the error names the document's
  // script rather than whichever node happened to carry the first letter of it.

  return {
    node,
    unsupportedClasses: offendingClasses,
    missingImages: missing,
    appliedBreaks: applied,
    unknownBreaks: [...breaks].filter((id) => !keeps.has(id)),
    unknownRepeats: plannedRepeats(options.plan).filter((id) => !keeps.has(id)),
  };
}

/**
 * A translated keep, copied to open a page.
 *
 * The copy carries `data-keep-repeat` for the same reason the preview's does:
 * it is not the keep's one place in the flow, so anything comparing the first
 * keep of a page has to read past it.
 *
 * It is an independent translation of the same source node, not a view onto the
 * original: `walk` allocates fresh objects, so writing here cannot reach the
 * header's own place in the flow. Translating the source twice costs nothing,
 * because the collectors it feeds record each offender once.
 *
 * The pagination style is built rather than inherited. A header the plan also
 * breaks on carries `break-before: page` in its own place in the flow, and a
 * copy that inherited it would break the page it was meant to open.
 */
function headerCopy(node: Node, opensPage: boolean): Node {
  const { breakBefore: _inherited, ...carried } = node.style ?? {};
  const style: CSSProperties = { ...carried, breakInside: "avoid" };
  if (opensPage) style.breakBefore = "page";

  return {
    ...node,
    attributes: { ...node.attributes, [KEEP_REPEAT_ATTRIBUTE]: "true" },
    style,
  };
}
