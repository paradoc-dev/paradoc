import { renderToStaticMarkup } from "react-dom/server";
import { createFormatter } from "@paradoc/format";
import { describe, expect, it } from "vitest";
import type { Form } from "@paradoc/types";

import { ArtifactProvider, FormatterProvider, useField } from "../src";

const formatter = createFormatter({ overrides: { money: () => "Render amount" } });
const artifact = { name: "format", fields: { amount: { type: "money", label: "Amount" } } } as unknown as Form;
const data = { fields: { amount: { amount: 12.5, currency: "EUR" } }, parties: {} };

function Probe() {
  return <span>{useField("amount").text}</span>;
}

describe("ArtifactProvider formatting", () => {
  it("uses the surrounding formatter when no explicit format prop overrides it", () => {
    const markup = renderToStaticMarkup(
      <FormatterProvider formatter={formatter}>
        <ArtifactProvider artifact={artifact} data={data}><Probe /></ArtifactProvider>
      </FormatterProvider>
    );
    expect(markup).toContain("Render amount");
  });
});
