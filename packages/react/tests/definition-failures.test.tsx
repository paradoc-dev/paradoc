// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Form } from "@paradoc/types";

import { ArtifactProvider, CheckModeProvider, PartialValuesProvider, useTotals } from "../src";

const form = {
  $schema: "https://schema.paradoc.dev/2026-09-24.json",
  kind: "form",
  name: "defs-fail",
  version: "1.0.0",
  title: "Defs fail",
  fields: { amount: { type: "number", label: "Amount" } },
  defs: { total: { type: "number", label: "Total", value: "fields.amount / 0" } },
} as unknown as Form;

const data = { fields: { amount: 5 }, parties: {} };

function Totals({ names = ["total"] }: { names?: string[] }) {
  return <p>[{useTotals(names).map((row) => row.text).join("|")}]</p>;
}

describe("computed-definition failures", () => {
  it("throws the diagnostic in a finished render", () => {
    expect(() => renderToStaticMarkup(
      <ArtifactProvider artifact={form} data={data}><Totals /></ArtifactProvider>
    )).toThrow(/defs\.total.*Division by zero/i);
  });

  it("prints the placeholder in a partial render", () => {
    const html = renderToStaticMarkup(
      <PartialValuesProvider partial>
        <ArtifactProvider artifact={form} data={data}><Totals /></ArtifactProvider>
      </PartialValuesProvider>
    );
    expect(html).toContain("—");
  });

  it("reports failed and unknown defs during a check", () => {
    const paths: string[] = [];
    const collector = { report: (path: string) => paths.push(path) };
    renderToStaticMarkup(
      <CheckModeProvider collector={collector}>
        <ArtifactProvider artifact={form} data={data}><Totals names={["total", "totl"]} /></ArtifactProvider>
      </CheckModeProvider>
    );
    expect(paths).toContain("defs.total");
    expect(paths).toContain("defs.totl");
  });
});
