/**
 * Starts a new page at its position, occupying no height of its own in
 * either output — a flex flow around it still puts its own gap where the
 * break sits, the way it would around any other keep.
 *
 * `PageBreak` is a `KeepTogether` like any other, carrying a stable `keepId`
 * and no content: the measuring pass reads its `data-break-before="page"`
 * attribute and the plan opens a fresh page there, the way it already opens
 * one for a keep that overflows. The preview and the PDF read the same plan,
 * so both start the next page at the same place.
 */
/** @jsxRuntime classic */
import React from "react";
import { RENDER_ATTRIBUTES } from "@paradoc/react";
import { KeepTogether } from "./keep-together";

export interface PageBreakProps {
  /** Stable id the page plan tracks this break by; must be unique within the document. */
  keepId: string;
  /**
   * The table this break sits inside, when it separates two of a hand-built
   * table's rows. Named the same way a row is, so the table's header still
   * repeats on the page the break opens.
   */
  table?: string;
}

export function PageBreak({ keepId, table }: PageBreakProps) {
  return (
    <KeepTogether
      keepId={keepId}
      {...{ [RENDER_ATTRIBUTES.breakBefore]: "page", [RENDER_ATTRIBUTES.tableRow]: table }}
      aria-hidden="true"
      className="h-0"
    />
  );
}
