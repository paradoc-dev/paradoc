/** @jsxRuntime classic */
import React from "react";

/**
 * Demo composition for the `/components/text` docs page.
 *
 * The three roles a page of prose actually uses, in the order they appear on
 * one: a heading, the paragraph under it, and a caption beneath that. Each
 * takes its size and leading from the document's typography token rather than
 * from a class written here. This is what the docs page's live Preview
 * renders, and its raw source is what the Composition section shows.
 */

import { Document } from "../components/document";
import { Text } from "../components/text";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function TextDemo() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="text-demo">
      <Text keepId="text-demo:heading" role="heading">
        Scope of services
      </Text>
      <Text keepId="text-demo:body">
        The provider will survey the site, install the equipment listed below, and commission it
        against the acceptance tests the parties agree in writing before work begins.
      </Text>
      <Text keepId="text-demo:caption" role="caption">
        Quantities are estimates until the survey is complete.
      </Text>
    </Document>
  );
}
