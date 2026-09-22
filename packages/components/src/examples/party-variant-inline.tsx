/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/party` docs page's "Inline" variant: `variant="inline"`
 * joins the same values into one run for a sentence, instead of stacking
 * them as a block.
 */

import { Document } from "../components/document";
import { Party } from "../components/party";
import { partyDemoForm } from "./party-artifact";
import { partyDemoData } from "./party-demo-data";

export function PartyVariantInline() {
  return (
    <Document artifact={partyDemoForm} data={partyDemoData} id="party-variant-inline">
      <Party role="buyer" variant="inline" label={false} />
    </Document>
  );
}
