import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { Document, Party } from "../src";
import { partyFixtureData as data, partyFixtureForm as artifact } from "./party-fixture";

it("prints the partial placeholder for a missing party", () => {
  const markup = renderToStaticMarkup(
    <Document artifact={artifact} data={data} format={{ partial: true }}>
      <Party role="witness" index={2} />
    </Document>
  );

  expect(markup).toContain("—");
});
