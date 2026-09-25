/**
 * "Page 2 of 7", drawn in a document's page furniture.
 *
 * It is the one component whose text neither the artifact nor the caller
 * supplies: the numbers come from whatever is drawing the page. In the preview
 * that is the page plan, so each sheet prints its own number. On the PDF path
 * the engine repeats the band on every page and fills the two counters itself,
 * which is why the slots are marked rather than merely printed: the
 * `data-page-counter` attributes are the contract the adapter translates into
 * whichever counter hook its engine reads. Nothing here names an engine.
 *
 * Put it in a `Pages` or `Paper` `furniture` slot and hand the same furniture
 * to `renderPdf`. Anywhere else it prints page 1 of 1, because anywhere else
 * there is one sheet.
 */
/** @jsxRuntime classic */
import React from "react";
import { PAGE_COUNTER_ATTRIBUTE, scaleTextClasses, useDocumentTokens, usePageNumber } from "@paradoc/react";

export interface PageNumberProps {
  /**
   * Words before the page number. Empty prints the number alone.
   * @default "Page"
   */
  label?: string;
  /**
   * Words between the page number and the page count.
   * @default "of"
   */
  separator?: string;
  /**
   * Prints the page count after the separator.
   * @default true
   */
  total?: boolean;
  /** Application-owned classes on the wrapper. */
  className?: string;
}

/** The page being drawn, and how many there are. */
export function PageNumber({
  label = "Page",
  separator = "of",
  total = true,
  className,
}: PageNumberProps) {
  const { typography } = useDocumentTokens();
  const { page, pages } = usePageNumber();
  return (
    <span
      data-page-number="true"
      className={className ?? scaleTextClasses("text-xs text-neutral-500", typography.scale)}
    >
      {label === "" ? null : `${label} `}
      <span {...{ [PAGE_COUNTER_ATTRIBUTE]: "current" }}>{page}</span>
      {total ? (
        <>
          {` ${separator} `}
          <span {...{ [PAGE_COUNTER_ATTRIBUTE]: "total" }}>{pages}</span>
        </>
      ) : null}
    </span>
  );
}
