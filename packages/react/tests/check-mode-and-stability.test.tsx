// @vitest-environment jsdom

import { act, memo, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Form, Party } from "@paradoc/types";

import { ArtifactProvider, CheckModeProvider, useField, useList, useParty, usePartyContact, useSignature } from "../src";

const artifact = {
  name: "hook-contracts",
  fields: {
    name: { type: "text", label: "Name" },
    lineItems: { type: "list", label: "Items", item: { type: "text", label: "Item" } },
  },
  parties: { owner: { label: "Owner", partyType: "person" } },
} as unknown as Form;

describe("document placeholders", () => {
  const format = { blank: "", partial: true, progressive: { missing: "Pending", incomplete: "Pending" } };

  it("uses the document placeholder for an unfilled signature party", () => {
    function Probe() {
      return <><i>{useField("name").text}</i><b>{useSignature("owner").partyText}</b></>;
    }
    const markup = renderToStaticMarkup(
      <ArtifactProvider artifact={artifact} data={{ fields: {}, parties: {} }} format={format}><Probe /></ArtifactProvider>
    );
    expect(markup).toContain("<i>Pending</i>");
    expect(markup).toContain("<b>Pending</b>");
  });

  it("uses the document placeholder for a filled party without a name", () => {
    function Probe() { return <b>{usePartyContact("owner").nameText}</b>; }
    expect(renderToStaticMarkup(
      <ArtifactProvider artifact={artifact} data={{ fields: {}, parties: { owner: {} as Party } }} format={format}><Probe /></ArtifactProvider>
    )).toContain("<b>Pending</b>");
  });

  it("applies the same finished-document missing-party rule to signatures", () => {
    function Probe() { useSignature("owner"); return null; }
    expect(() => renderToStaticMarkup(
      <ArtifactProvider artifact={artifact} data={{ fields: {}, parties: {} }}><Probe /></ArtifactProvider>
    )).toThrow(/out of range/);
  });
});

describe("list absence", () => {
  function Rows() { return <span>{useList("lineItems").rows.length}</span>; }

  it.each([undefined, null])("treats %s as an absent list", (lineItems) => {
    expect(renderToStaticMarkup(
      <ArtifactProvider artifact={artifact} data={{ fields: { lineItems }, parties: {} }}><Rows /></ArtifactProvider>
    )).toBe("<span>0</span>");
  });

  it("reports an undeclared row child during a check instead of aborting", () => {
    const reported: string[] = [];
    function Probe() { return <span>{useList("lineItems").text(0, "missing")}</span>; }
    expect(renderToStaticMarkup(
      <CheckModeProvider collector={{ report: (path) => reported.push(path) }}>
        <ArtifactProvider artifact={artifact} data={{ fields: { lineItems: ["item"] }, parties: {} }}><Probe /></ArtifactProvider>
      </CheckModeProvider>
    )).toBe("<span>—</span>");
    expect(reported).toEqual(["lineItems.0.missing"]);
  });
});

describe("focused selector stability", () => {
  it.each(["party", "list"] as const)("does not republish an unchanged %s", async (kind) => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const node = document.createElement("div");
    const root = createRoot(node);
    const renders = vi.fn();
    const owner = { id: "owner-1", name: "Ada" };
    const Probe = memo(function Probe() {
      renders();
      const parties = useParty("owner");
      const list = useList("lineItems");
      return <span>{kind === "party" ? parties.length : list.rows.length}</span>;
    });
    const render = (name: string) => root.render(
      <StrictMode><ArtifactProvider artifact={artifact} data={{ fields: { name }, parties: { owner } }}><Probe /></ArtifactProvider></StrictMode>
    );
    await act(async () => render("first"));
    const initial = renders.mock.calls.length;
    await act(async () => render("second"));
    expect(renders).toHaveBeenCalledTimes(initial);
    await act(async () => root.unmount());
  });
});
