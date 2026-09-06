/**
 * `KeepTogether` is the one place a pagination unit is declared.
 *
 * Every `data-keep-id` in the document comes from here, so the two halves of
 * the rule cannot drift apart: the attribute the measuring pass reads and the
 * decision to render on a given page are the same component. A keep outside a
 * page renders unconditionally, which is how the measuring pass sees them all.
 *
 * A keep the plan copied onto a page — only ever a repeated table header —
 * also carries `data-keep-repeat`, because it is not the keep's one place in
 * the flow. The parity suite reads a page's first real keep past it, and the PDF path
 * marks its own copy the same way.
 */

import type { AllHTMLAttributes, ElementType, ReactNode } from "react";

import { useKeepVisible, usePage } from "./page-context";

/**
 * `as` chooses the element, so the props are every element's: the masthead's
 * organization mark is a keep and needs `src`, which a `div`'s attributes do
 * not carry. `as` itself is dropped from that set: here it names the element,
 * not the HTML attribute of the same name.
 */
export interface KeepTogetherProps extends Omit<AllHTMLAttributes<HTMLElement>, "as"> {
  /** Stable keep id. The PDF engine is hinted with the same id. */
  keepId: string;
  /** Element to render. Defaults to a `div`. */
  as?: ElementType;
  children?: ReactNode;
}

/** One pagination unit: never split, and rendered only on the pages that hold it. */
export function KeepTogether({ keepId, as: Tag = "div", children, ...rest }: KeepTogetherProps) {
  const visible = useKeepVisible(keepId);
  const repeated = usePage()?.repeats.has(keepId) === true;
  if (!visible) return null;

  return (
    <Tag {...rest} data-keep-id={keepId} data-keep-repeat={repeated ? "true" : undefined}>
      {children}
    </Tag>
  );
}
