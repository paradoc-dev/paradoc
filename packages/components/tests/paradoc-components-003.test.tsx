import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { Bundle, Document, Party } from "../src";
import { partyFixtureData as data, partyFixtureForm as artifact } from "./party-fixture";

it("uses Document ids as DOM markers without scoping keep ids", () => {
  const element = (
    <Bundle>
      <Document id="first" artifact={artifact} data={data}>
        <Party role="buyer" />
      </Document>
      <Document id="second" artifact={artifact} data={data}>
        <Party role="buyer" />
      </Document>
    </Bundle>
  );

  const markup = renderToStaticMarkup(element);
  expect(markup).toContain('data-document-id="first"');
  expect(markup).toContain('data-document-id="second"');
  expect(markup.match(/data-keep-id="party:buyer"/gu)).toHaveLength(2);
});
