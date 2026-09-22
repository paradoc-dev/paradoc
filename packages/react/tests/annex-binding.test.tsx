/**
 * What an annex binding promises.
 *
 * An attachment is not a field value: the artifact declares annex slots and the
 * filled data carries one `Attachment` per slot. The path grammar is the shared
 * formatter's own — `annexes.<slot>` — so a composition that prints an
 * attachment prints what the text, DOCX and PDF outputs print, and a slot the
 * artifact does not declare fails by name the way a field path does.
 */

import { renderToStaticMarkup } from "react-dom/server";
import type { Form } from "@paradoc/types";
import { describe, expect, it } from "vitest";

import { ArtifactProvider, UnknownAnnexError, readAnnex, resolveAnnex, useAnnex } from "../src";
import { proposalForm } from "../../components/src/examples/proposal";
import { shortProposalData } from "../../components/src/examples/proposal-data";

function Bound({ path }: { path: string }) {
  const binding = useAnnex(path);
  return (
    <p>
      {binding.label}|{binding.attachment?.mimeType ?? "none"}|{binding.text}
    </p>
  );
}

function render(path: string, data = shortProposalData) {
  return renderToStaticMarkup(
    <ArtifactProvider artifact={proposalForm} data={data}>
      <Bound path={path} />
    </ArtifactProvider>
  );
}

describe("resolving an annex slot", () => {
  it("resolves a declared slot and reads its attachment", () => {
    expect(resolveAnnex(proposalForm, "annexes.sitePhoto").title).toBe("Site photograph");
    expect(readAnnex(shortProposalData.annexes, "annexes.sitePhoto")?.mimeType).toBe("image/png");
  });

  it("fails by name on an undeclared slot and on a path that is not an annex path", () => {
    expect(() => resolveAnnex(proposalForm, "annexes.floorPlan")).toThrow(UnknownAnnexError);
    expect(() => resolveAnnex(proposalForm, "annexes.floorPlan")).toThrow(/annexes\.floorPlan/);
    expect(() => resolveAnnex(proposalForm, "sitePhoto")).toThrow(UnknownAnnexError);
    expect(() => resolveAnnex(proposalForm, "annexes.sitePhoto.name")).toThrow(UnknownAnnexError);
  });

  it("resolves an undeclared slot on a form that admits ad-hoc annexes", () => {
    const open: Form = { ...proposalForm, allowAdditionalAnnexes: true };
    expect(resolveAnnex(open, "annexes.floorPlan")).toEqual({});
  });

  it("reads nothing for an annex path out of a document carrying no annexes", () => {
    expect(readAnnex(undefined, "annexes.sitePhoto")).toBeUndefined();
    expect(readAnnex(shortProposalData.annexes, "sitePhoto")).toBeUndefined();
  });
});

describe("the annex binding", () => {
  it("prints the slot's title and the attachment as the shared formatter does", () => {
    expect(render("annexes.sitePhoto")).toBe(
      "<p>Site photograph|image/png|harbor-yard.png (image/png)</p>"
    );
  });

  it("carries no attachment and prints the blank placeholder for an unfilled slot", () => {
    expect(render("annexes.sitePhoto", { ...shortProposalData, annexes: {} })).toBe(
      "<p>Site photograph|none|—</p>"
    );
  });

  it("throws for a slot the artifact does not declare", () => {
    expect(() => render("annexes.floorPlan")).toThrow(UnknownAnnexError);
  });
});
