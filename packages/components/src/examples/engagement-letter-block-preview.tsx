/** @jsxRuntime classic */
import React from "react";

/**
 * Block-preview wrapper for the `/components/blocks/engagement-letter` docs
 * page.
 *
 * `EngagementLetterDocument` renders bare — see its own doc comment, "There
 * is no `Bundle`" — because a letter is one document and a composition
 * expects its own caller to paginate it, the same way any top-level route in
 * a consumer's project would. The registry's shipped composition is exactly
 * that bare tree, so the docs site's live Preview needs this thin wrapper to
 * actually paginate it; this is the whole of what it does.
 */

import { Pages } from "../components/pages";
import { engagementLetterData } from "./engagement-letter-data";
import { EngagementLetterDocument } from "./engagement-letter-document";

export function EngagementLetterBlockPreview() {
  return (
    <Pages>
      <EngagementLetterDocument data={engagementLetterData} />
    </Pages>
  );
}
