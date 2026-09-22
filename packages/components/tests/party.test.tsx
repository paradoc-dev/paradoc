import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PartyIndexOutOfRangeError, UnknownPartyRoleError } from "@paradoc/react";
import { Document, Party } from "../src";
import { partyFixtureData as data, partyFixtureForm as artifact } from "./party-fixture";

describe("Party", () => {
  it("prints the name, organization, address, and contact each on their own line as a block", () => {
    const html = renderToStaticMarkup(
      <Document artifact={artifact} data={data}>
        <Party role="buyer" />
      </Document>
    );
    expect(html).toContain('data-party-role="buyer"');
    expect(html).toContain('data-party-index="0"');
    expect(html).toContain('data-keep-id="party:buyer"');
    expect(html).toContain(">Buyer<");
    expect(html).toContain(">Dana Whitfield<");
    expect(html).toContain(">Northgate Systems<");
    expect(html).toContain(">1400 Rio Grande Street");
    expect(html).toContain(">+15125550123<");
  });

  it("hides the heading when label is false and overrides it with a string", () => {
    expect(renderToStaticMarkup(
      <Document artifact={artifact} data={data}><Party role="buyer" label={false} /></Document>
    )).not.toContain(">Buyer<");
    expect(renderToStaticMarkup(
      <Document artifact={artifact} data={data}><Party role="buyer" label="Bill to" /></Document>
    )).toContain(">Bill to<");
  });

  it("joins the name, organization, address, and contact into one run inline", () => {
    const html = renderToStaticMarkup(
      <Document artifact={artifact} data={data}>
        <Party role="buyer" variant="inline" />
      </Document>
    );
    expect(html).toContain('<span data-party-role="buyer" data-party-index="0" data-keep-id="party:buyer">');
    expect(html).toContain("Buyer, Dana Whitfield, Northgate Systems, 1400 Rio Grande Street");
    expect(html).toContain("+15125550123");
  });

  it("selects the party at the given index for a role filled more than once, printing every member for each", () => {
    const html = renderToStaticMarkup(
      <Document artifact={artifact} data={data}>
        <Party role="witness" index={0} />
        <Party role="witness" index={1} />
        <Party role="witness" index={1} variant="inline" label={false} />
      </Document>
    );
    expect(html).toContain('data-keep-id="party:witness"');
    expect(html).toContain('data-keep-id="party:witness:1"');
    // The first witness carries only a name: nothing else prints for it.
    expect(html).toContain(">First Witness<");
    // The second carries all three extension members, block and inline alike.
    expect(html).toContain(">Second Witness<");
    expect(html).toContain(">Harbor Freight Collective<");
    expect(html).toContain(">88 Wharf Road");
    expect(html).toContain(">+15105550199<");
    expect(html).toContain("Second Witness, Harbor Freight Collective, 88 Wharf Road");
  });

  it("omits a member the party record does not carry, rather than printing it blank", () => {
    const html = renderToStaticMarkup(
      <Document artifact={artifact} data={data}><Party role="witness" index={0} /></Document>
    );
    expect(html).not.toContain("Harbor Freight Collective");
    expect(html).not.toContain("Wharf Road");
  });

  it("overrides the keep id and passes through className", () => {
    const html = renderToStaticMarkup(
      <Document artifact={artifact} data={data}>
        <Party role="buyer" keepId="custom-buyer" className="custom-party" />
      </Document>
    );
    expect(html).toContain('data-keep-id="custom-buyer"');
    expect(html).toContain('class="custom-party"');
  });

  it("fails an undeclared role by name", () => {
    expect(() =>
      renderToStaticMarkup(<Document artifact={artifact} data={data}><Party role="missing" /></Document>)
    ).toThrow(UnknownPartyRoleError);
  });

  it("fails an index past the filled parties by name", () => {
    expect(() =>
      renderToStaticMarkup(<Document artifact={artifact} data={data}><Party role="witness" index={2} /></Document>)
    ).toThrow(PartyIndexOutOfRangeError);
  });
});
