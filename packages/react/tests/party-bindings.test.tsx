// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Form } from "@paradoc/types";

import { ArtifactProvider, PartyIndexOutOfRangeError, UnknownPartyRoleError, usePartyContact } from "../src";

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

  it("fails an index past the filled parties by name", () => {
    function OutOfRange() { usePartyContact("witness", 2); return null; }
    expect(() =>
      renderToStaticMarkup(<ArtifactProvider artifact={artifact} data={data}><OutOfRange /></ArtifactProvider>)
    ).toThrow(PartyIndexOutOfRangeError);
  });
});
