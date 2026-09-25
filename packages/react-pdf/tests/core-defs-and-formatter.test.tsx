import { createFormatter } from "@paradoc/format";
import { pageTextRuns } from "@paradoc/render/pdf";
import { ArtifactProvider, useTotals } from "@paradoc/react";
import { describe, expect, it } from "vitest";
import type { Form } from "@paradoc/types";

import { Document } from "../../components/src/components/document";
import { Field } from "../../components/src/components/field";
import { reactRenderer, type ReactLayerComponentProps } from "../src/layer";
import { renderPdf } from "../src/render";

const artifact = {
  $schema: "https://schema.paradoc.dev/2026-09-24.json",
  kind: "form",
  name: "clock-def",
  version: "1.0.0",
  title: "Clock def",
  fields: { amount: { type: "money", label: "Amount" } },
  defs: { issued: { type: "date", label: "Issued", value: "today()" } },
} as unknown as Form;

describe("core render data and formatting", () => {
  it("passes core's computed defs to the React composition", async () => {
    let seenValue: unknown;
    function Probe() {
      seenValue = useTotals(["issued"])[0]?.value;
      return <p>probe</p>;
    }
    function Composition(props: ReactLayerComponentProps) {
      return <ArtifactProvider artifact={props.artifact} data={props.data}><Probe /></ArtifactProvider>;
    }
    const renderer = reactRenderer({ components: { "po.tsx": Composition } });
    await renderer.render({
      kind: "form",
      artifact,
      template: { kind: "file", mimeType: "text/tsx", path: "po.tsx" },
      data: { fields: { amount: 1 }, parties: {}, defs: { issued: "2026-09-24" } },
    } as never);
    expect(seenValue).toBe("2026-09-24");
  }, 60_000);

  it("applies renderPdf's formatter to a Document with no format prop", async () => {
    const formatter = createFormatter({ overrides: { money: () => "Render amount" } });
    const element = (
      <Document artifact={artifact} data={{ fields: { amount: { amount: 12.5, currency: "EUR" } }, parties: {}, defs: { issued: "2026-09-24" } }}>
        <Field path="amount" />
      </Document>
    );
    const { bytes } = await renderPdf(element, { formatter });
    const text = (await pageTextRuns(bytes)).flatMap((page) => page.runs.map((run) => run.text)).join("");
    expect(text).toContain("Render amount");
  }, 60_000);
});
