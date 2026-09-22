/** @jsxRuntime classic */
import React from "react";

/**
 * Demo composition for the `/components/party` docs page.
 *
 * The buyer's block: name, organization, address, and contact each on their
 * own line, read from the filled `buyer` role. This is what the docs page's
 * live Preview renders, and its raw source is what the Composition section
 * shows.
 */

import { Document } from "../components/document";
import { Party } from "../components/party";
import { partyDemoForm } from "./party-artifact";
import { partyDemoData } from "./party-demo-data";

export function PartyDemo() {
  return (
    <Document artifact={partyDemoForm} data={partyDemoData} id="party-demo">
      <Party role="buyer" />
    </Document>
  );
}
