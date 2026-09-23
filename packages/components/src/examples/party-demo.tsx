/** @jsxRuntime classic */
import React from "react";

/**
 * Demo composition for the `/components/party` docs page.
 *
 * The buyer's block: the name from the filled `buyer` role, then the
 * organization, address, and contact from the fields its paths name, each on
 * its own line. This is what the docs page's
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
      <Party role="buyer" organization="buyerOrganization" address="buyerAddress" contact="buyerPhone" />
    </Document>
  );
}
