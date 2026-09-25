/** @jsxRuntime classic */
import React from "react";
import type { PageFurniture } from "@paradoc/react";

import { PageNumber } from "../components/page-number";
import { shortProposalData } from "./proposal-data";

/**
 * The page furniture the sample proposal is measured with.
 *
 * Sample material, like the rest of `./examples`. The parity suite draws the
 * proposal with it in the preview and hands the same object to both engines,
 * so a furnished document is measured on the page it is drawn on. It carries
 * all three slots: a running head with text at both ends of the band, a foot
 * whose page number the engine fills, and a stamp dark enough that the
 * suite's comparison sees it rather than reading it as paper, turned the way
 * the documented draft watermark is.
 */

/** The firm the running head names. */
export const PROPOSAL_FURNITURE_FIRM = String(
  (shortProposalData.fields.provider as { name?: unknown }).name ?? ""
);

/** The document the running head names. */
export const PROPOSAL_FURNITURE_TITLE = "Services proposal";

/** The stamp's text. */
export const PROPOSAL_FURNITURE_STAMP = "DRAFT";

/** What the sample furniture can be varied by. */
export interface ProposalFurnitureOptions {
  /**
   * The word before the page number in the foot. The parity suite's control
   * changes it on one output only, to prove a foot that differs fails the page.
   * @default "Page"
   */
  footerLabel?: string;
}

/** The proposal's running head, numbered foot, and draft stamp. */
export function proposalFurniture({ footerLabel = "Page" }: ProposalFurnitureOptions = {}): PageFurniture {
  return {
    header: (
      <div className="flex justify-between text-xs text-neutral-500">
        <span>{PROPOSAL_FURNITURE_FIRM}</span>
        <span>{PROPOSAL_FURNITURE_TITLE}</span>
      </div>
    ),
    footer: (
      <div className="flex justify-end">
        <PageNumber label={footerLabel} />
      </div>
    ),
    stamp: (
      <span className="-rotate-45 text-6xl font-semibold text-neutral-300">{PROPOSAL_FURNITURE_STAMP}</span>
    ),
  };
}
