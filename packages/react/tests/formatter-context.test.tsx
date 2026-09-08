// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { createFormatter } from "@paradoc/format";
import { Document } from "../../components/src/components/document";
import { Field } from "../../components/src/components/field";
import type { Form } from "@paradoc/types";

it("refreshes field text when a formatter changes inside otherwise stable props", async () => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  const root = createRoot(host);
  const artifact = { name: "format", fields: { amount: { type: "money" } } } as unknown as Form;
  const data = { fields: { amount: { amount: 12.5, currency: "EUR" } }, parties: {} };
  const format = { formatter: createFormatter({ locale: "en-US" }) };
  const element = () => <Document artifact={artifact} data={data} format={format}><Field path="amount" /></Document>;
  try {
    await act(async () => { root.render(element()); });
    expect(host.textContent).toContain("€12.50");
    format.formatter = createFormatter({ locale: "de-DE" });
    await act(async () => { root.render(element()); });
    expect(host.textContent).toContain("12,50\u00a0€");
    format.formatter = createFormatter({ overrides: { money: () => "Artifact amount" } });
    await act(async () => { root.render(element()); });
    expect(host.textContent).toContain("Artifact amount");
  } finally { await act(async () => { root.unmount(); }); }
});
