// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Form } from "@paradoc/types";

import {
  ArtifactProvider,
  PartialValuesProvider,
  PartyIndexOutOfRangeError,
  UnknownPartyRoleError,
  usePartyContact,
  type FormatOptions,
} from "../src";

const artifact = {
  name: "party-bindings",
  fields: {},
  parties: {
    buyer: { label: "Buyer", partyType: "person", min: 1, max: 1 },
    witness: { label: "Witness", partyType: "person", min: 0, max: 3 },
  },
} as unknown as Form;

const data = {
  fields: {},
  parties: {
    buyer: {
      id: "buyer-0",
      name: "Dana Whitfield",
      organization: { name: "Northgate Systems" },
      address: { line1: "1400 Rio Grande Street", locality: "Austin", region: "TX", postalCode: "78701", country: "US" },
      phone: { number: "+15125550123" },
    },
    witness: [
      { id: "witness-0", name: "First Witness" },
      { id: "witness-1", name: "Second Witness" },
    ],
  },
};

function Report({ role, index }: { role: string; index?: number }) {
  const binding = usePartyContact(role, index);
  return (
    <p>
      {binding.nameText}|{binding.organizationText ?? "none"}|{binding.addressText ?? "none"}|{binding.contactText ?? "none"}
    </p>
  );
}

function renderReport(role: string, index?: number) {
  return renderToStaticMarkup(
    <ArtifactProvider artifact={artifact} data={data}>
      <Report role={role} index={index} />
    </ArtifactProvider>
  );
}

describe("usePartyContact", () => {
  it("formats a single-filled party's name, organization, address, and contact through the shared formatter", () => {
    const html = renderReport("buyer");
    expect(html).toContain("Dana Whitfield");
    expect(html).toContain("Northgate Systems");
    expect(html).toContain("1400 Rio Grande Street");
    expect(html).toContain("+15125550123");
  });

  it("omits a member the party record does not carry, rather than printing it blank", () => {
    const html = renderReport("witness", 0);
    expect(html).toContain("First Witness|none|none|none");
  });

  it("selects the party at the given index for a role filled more than once", () => {
    expect(renderReport("witness", 0)).toContain("First Witness");
    expect(renderReport("witness", 1)).toContain("Second Witness");
  });

  it("prints a placeholder rather than throwing for a party mid-fill", () => {
    // An organization whose name has not been answered yet is the normal
    // state of a document being filled, not a fault — the same treatment
    // `useSignature` gives a party's own name.
    const midFill = {
      fields: {},
      parties: { buyer: { id: "buyer-0", name: "Dana Whitfield", organization: {} } },
    };
    const html = renderToStaticMarkup(
      <ArtifactProvider artifact={artifact} data={midFill}>
        <Report role="buyer" />
      </ArtifactProvider>
    );
    expect(html).toContain("Dana Whitfield|—|none|none");
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
