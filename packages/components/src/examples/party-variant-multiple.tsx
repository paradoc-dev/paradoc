/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/party` docs page's "Multiple parties" variant: `witness`
 * admits up to two parties, and `index` selects which one this block prints.
 */

import { Document } from "../components/document";
import { Party } from "../components/party";
import { partyDemoForm } from "./party-artifact";
import { partyDemoData } from "./party-demo-data";

export function PartyVariantMultiple() {
  return (
    <Document artifact={partyDemoForm} data={partyDemoData} id="party-variant-multiple">
      <div className="flex flex-col gap-4">
        <Party role="witness" index={0} />
        <Party role="witness" index={1} />
      </div>
    </Document>
  );
}
