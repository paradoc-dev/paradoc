// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Form } from "@paradoc/types";

import {
  ArtifactProvider,
  CheckModeProvider,
  PartialValuesProvider,
  PartyIndexOutOfRangeError,
  UnknownPartyRoleError,
  UnknownFieldPathError,
  usePartyContact,
  type FormatOptions,
  type PartyContactPaths,
} from "../src";

const artifact = {
  name: "party-bindings",
  fields: {
    buyerOrganization: { type: "organization", label: "Buyer organization" },
    buyerAddress: { type: "address", label: "Buyer address" },
    buyerPhone: { type: "phone", label: "Buyer phone" },
    buyerEmail: { type: "email", label: "Buyer email" },
    witnessContacts: {
      type: "list",
      label: "Witness contacts",
      item: {
        type: "fieldset",
        label: "Witness contact",
        fields: { address: { type: "address", label: "Address" } },
      },
    },
  },
  parties: {
    buyer: { label: "Buyer", partyType: "person", min: 1, max: 1 },
    witness: { label: "Witness", partyType: "person", min: 0, max: 3 },
  },
} as unknown as Form;

const data = {
  fields: {
    buyerOrganization: { name: "Northgate Systems" },
    buyerAddress: { line1: "1400 Rio Grande Street", locality: "Austin", region: "TX", postalCode: "78701", country: "US" },
    buyerPhone: { number: "+15125550123" },
    buyerEmail: "dana@northgate.example",
    witnessContacts: [
      { address: { line1: "12 First Street", locality: "Austin", region: "TX", postalCode: "78702", country: "US" } },
      { address: { line1: "88 Wharf Road", locality: "Oakland", region: "CA", postalCode: "94607", country: "US" } },
    ],
  },
  parties: {
    buyer: { id: "buyer-0", name: "Dana Whitfield" },
    witness: [
      { id: "witness-0", name: "First Witness" },
      { id: "witness-1", name: "Second Witness" },
    ],
  },
};

const buyerPaths: PartyContactPaths = {
  organization: "buyerOrganization",
  address: "buyerAddress",
  contact: ["buyerPhone", "buyerEmail"],
};

function Report({ role, index, paths }: { role: string; index?: number; paths?: PartyContactPaths }) {
  const binding = usePartyContact(role, index, paths);
  return (
    <p>
      {binding.nameText}|{binding.organizationText ?? "none"}|{binding.addressText ?? "none"}|{binding.contactText ?? "none"}
    </p>
  );
}

function renderReport(role: string, index?: number, paths?: PartyContactPaths, fields: Record<string, unknown> = data.fields) {
  return renderToStaticMarkup(
    <ArtifactProvider artifact={artifact} data={{ ...data, fields }}>
      <Report role={role} index={index} paths={paths} />
    </ArtifactProvider>
  );
}

describe("usePartyContact", () => {
  it("prints the party's name from its record and its other lines from the fields its paths name", () => {
    const html = renderReport("buyer", 0, buyerPaths);
    expect(html).toContain("Dana Whitfield|Northgate Systems|1400 Rio Grande Street");
    expect(html).toContain("+15125550123, dana@northgate.example");
  });

  it("prints only the name when no paths are bound", () => {
    expect(renderReport("buyer")).toContain("Dana Whitfield|none|none|none");
  });

  it("leaves off a bound line whose field is blank", () => {
    const html = renderReport("buyer", 0, buyerPaths, { buyerEmail: "dana@northgate.example" });
    expect(html).toContain("Dana Whitfield|none|none|dana@northgate.example");
  });

  it("binds each party of a multiply-filled role to its own list item", () => {
    expect(renderReport("witness", 0, { address: "witnessContacts.0.address" })).toContain("First Witness|none|12 First Street");
    expect(renderReport("witness", 1, { address: "witnessContacts.1.address" })).toContain("Second Witness|none|88 Wharf Road");
  });

  it("fails a path the artifact does not declare by name", () => {
    expect(() => renderReport("buyer", 0, { address: "buyerHome" })).toThrow(UnknownFieldPathError);
  });

  it("reports a path the artifact does not declare to a check instead of throwing", () => {
    const reported: string[] = [];
    const html = renderToStaticMarkup(
      <CheckModeProvider collector={{ report: (path) => reported.push(path) }}>
        <ArtifactProvider artifact={artifact} data={data}>
          <Report role="buyer" paths={{ address: "buyerHome" }} />
        </ArtifactProvider>
      </CheckModeProvider>
    );
    expect(reported).toEqual(["buyerHome"]);
    expect(html).toContain("Dana Whitfield|none|none|none");
  });

  it("fails an undeclared role by name", () => {
    function UnknownRole() { usePartyContact("missing"); return null; }
    expect(() =>
      renderToStaticMarkup(<ArtifactProvider artifact={artifact} data={data}><UnknownRole /></ArtifactProvider>)
    ).toThrow(UnknownPartyRoleError);
  });

  describe("a party not answered yet", () => {
    const unanswered = { fields: {}, parties: { buyer: data.parties.buyer } };

    function renderUnanswered(format?: FormatOptions) {
      return renderToStaticMarkup(
        <ArtifactProvider artifact={artifact} data={unanswered} format={format}>
          <Report role="witness" />
        </ArtifactProvider>
      );
    }

    it("prints the document's placeholder in partial mode", () => {
      expect(renderUnanswered({ partial: true })).toContain("—|none|none|none");
    });

    it("prints the document's own blank, as a Field does", () => {
      expect(renderUnanswered({ partial: true, blank: "(pending)" })).toContain("(pending)|none|none|none");
    });

    it("prints the progressive missing text when the document sets one", () => {
      expect(
        renderUnanswered({ partial: true, progressive: { missing: "[to come]", incomplete: "…" } })
      ).toContain("[to come]|none|none|none");
    });

    it("prints the placeholder when partial mode is inherited from the caller", () => {
      const html = renderToStaticMarkup(
        <PartialValuesProvider partial>
          <ArtifactProvider artifact={artifact} data={unanswered}>
            <Report role="witness" />
          </ArtifactProvider>
        </PartialValuesProvider>
      );
      expect(html).toContain("—|none|none|none");
    });

    it("fails by name in a finished document", () => {
      expect(() => renderUnanswered()).toThrow(PartyIndexOutOfRangeError);
      expect(() => renderUnanswered({ partial: false })).toThrow('Party role "witness" has 0 parties filled; index 0 is out of range.');
    });
  });

  it("fails an index past the filled parties by name", () => {
    function OutOfRange() { usePartyContact("witness", 2); return null; }
    expect(() =>
      renderToStaticMarkup(<ArtifactProvider artifact={artifact} data={data}><OutOfRange /></ArtifactProvider>)
    ).toThrow(PartyIndexOutOfRangeError);
  });
});
