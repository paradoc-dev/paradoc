/**
 * An ordered or unordered list whose markers are text.
 *
 * The engine draws no list markers of its own — `list-decimal` and its family
 * are outside the verified vocabulary — so a composition that wanted numbered
 * clauses built a row layout and wrote the numbers itself. This does the same
 * thing once: the marker is a span of text beside the item's own text, so the
 * preview and the PDF draw the same characters rather than each asking its
 * renderer for a marker.
 *
 * **Every item is a pagination unit.** A list is the one structure long enough
 * to cross a page in the middle, and an item is the smallest piece of it that
 * still reads: its marker and its words belong on one page. So each item is a
 * `KeepTogether` of its own, keyed `<id>:<index>`, and a nested item extends
 * its parent's key rather than starting a new one.
 *
 * **A nested list carries its parent's marker as a prefix.** Item 2's second
 * sub-item reads `2.b.`, which is how a numbered agreement refers to itself.
 * A bullet contributes nothing to the chain, because a bullet names nothing.
 *
 * **A level withdraws from a page holding none of its items**, exactly as
 * `Table` does: an empty flex child still takes its parent's gap and would make
 * the drawn page taller than the flow the plan was measured against.
 */
/** @jsxRuntime classic */
import React from "react";
import { flowGapClasses, scaleTextClasses, useDocumentTokens, usePage } from "@paradoc/react";
import type { ReactNode } from "react";
import { KeepTogether } from "./keep-together";

/** How an item's marker is written. */
export type ListMarker = "decimal" | "lower-alpha" | "roman" | "bullet";

/** The character an unordered item is marked with. */
const BULLET = "•";

/** Roman numerals, largest first, so a token is built by subtraction. */
const ROMAN_NUMERALS: readonly (readonly [number, string])[] = [
  [1000, "m"],
  [900, "cm"],
  [500, "d"],
  [400, "cd"],
  [100, "c"],
  [90, "xc"],
  [50, "l"],
  [40, "xl"],
  [10, "x"],
  [9, "ix"],
  [5, "v"],
  [4, "iv"],
  [1, "i"],
];

/** `1` as `i`, `4` as `iv`, and so on. */
function romanToken(value: number): string {
  let left = value;
  let token = "";
  for (const [amount, numeral] of ROMAN_NUMERALS) {
    while (left >= amount) {
      token += numeral;
      left -= amount;
    }
  }
  return token;
}

/** `0` as `a`, `26` as `aa`: the spreadsheet column rule, so a long list never repeats a marker. */
function alphaToken(index: number): string {
  let left = index;
  let token = "";
  do {
    token = String.fromCharCode(97 + (left % 26)) + token;
    left = Math.floor(left / 26) - 1;
  } while (left >= 0);
  return token;
}

/** What one item of a level is marked with, before any parent prefix. */
function markerToken(marker: ListMarker, index: number): string {
  if (marker === "decimal") return String(index + 1);
  if (marker === "lower-alpha") return alphaToken(index);
  if (marker === "roman") return romanToken(index + 1);
  return BULLET;
}

/** One item of a list. */
export interface ListItem {
  /** The item's own text. */
  text: ReactNode;
  /** Items nested under this one. Their markers carry this item's as a prefix. */
  items?: readonly ListItem[];
}

export interface ListProps {
  /** The items, in order. */
  items: readonly ListItem[];
  /**
   * How the top level's items are marked.
   *
   * @default "decimal"
   */
  marker?: ListMarker;
  /**
   * How every level nested under the top one is marked.
   *
   * @default "lower-alpha"
   */
  nestedMarker?: ListMarker;
  /**
   * Prefix for each item's pagination id; an item's own id is `<id>:<index>`.
   *
   * Required rather than defaulted: two lists sharing a prefix would claim the
   * same keep ids, and a duplicated id fails the whole page plan.
   */
  id: string;
  /** Classes replacing the top level's default column layout; a nested level keeps its own. */
  className?: string;
}

/** Every keep id at or under `items`, so a level knows whether this page holds any of it. */
function keepIdsOf(items: readonly ListItem[], keepPrefix: string, into: string[] = []): string[] {
  items.forEach((item, index) => {
    const keepId = `${keepPrefix}:${index}`;
    into.push(keepId);
    if (item.items?.length) keepIdsOf(item.items, keepId, into);
  });
  return into;
}

interface ListLevelProps {
  items: readonly ListItem[];
  marker: ListMarker;
  nestedMarker: ListMarker;
  /** The ordered markers of this level's ancestors, outermost first. */
  prefix: readonly string[];
  keepPrefix: string;
  nested: boolean;
  className?: string;
}

function ListLevel({ items, marker, nestedMarker, prefix, keepPrefix, nested, className }: ListLevelProps) {
  const page = usePage();
  const { typography } = useDocumentTokens();
  const keepIds = keepIdsOf(items, keepPrefix);
  if (keepIds.length === 0) return null;
  if (page && !keepIds.some((keepId) => page.keeps.has(keepId))) return null;
  // `gap-3` rather than `gap-2`: `flow` moves a gap two spacing units per
  // level, so a list set at `gap-2` would reach `gap-0` at compact and its
  // items would run together. Three is the smallest start that survives the
  // step.
  const layout = flowGapClasses("flex flex-col gap-3", typography.flow);
  return (
    <div className={className ?? (nested ? `${layout} pl-6` : layout)} data-list={keepPrefix}>
      {items.map((item, index) => {
        const keepId = `${keepPrefix}:${index}`;
        const token = markerToken(marker, index);
        const chain = marker === "bullet" ? prefix : [...prefix, token];
        const label = marker === "bullet" ? token : `${chain.join(".")}.`;
        return (
          <React.Fragment key={keepId}>
            <KeepTogether keepId={keepId} data-list-item={keepId} className="flex flex-row gap-3">
              <span
                data-list-marker={label}
                className={scaleTextClasses("basis-10 text-sm text-neutral-500", typography.scale)}
              >
                {label}
              </span>
              {/* The same classes `Text`'s `body` role carries, written here rather
                  than shared: an item's text is inside this keep, and a `Text`
                  would be a keep within a keep. Move both together. */}
              <span className={scaleTextClasses("flex-1 text-sm leading-relaxed text-neutral-800", typography.scale)}>
                {item.text}
              </span>
            </KeepTogether>
            {item.items?.length ? (
              <ListLevel
                items={item.items}
                marker={nestedMarker}
                nestedMarker={nestedMarker}
                prefix={chain}
                keepPrefix={keepId}
                nested
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export function List({ items, marker = "decimal", nestedMarker = "lower-alpha", id, className }: ListProps) {
  return (
    <ListLevel
      items={items}
      marker={marker}
      nestedMarker={nestedMarker}
      prefix={[]}
      keepPrefix={id}
      nested={false}
      className={className}
    />
  );
}
