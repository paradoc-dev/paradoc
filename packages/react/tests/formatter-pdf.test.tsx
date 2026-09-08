import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { createFormatter } from "@paradoc/format";
import { pageTextRuns } from "@paradoc/render/pdf";
import { Document } from "../../components/src/components/document";
import { Field } from "../../components/src/components/field";
import { Signature } from "../../components/src/components/signature";
import { useTotals } from "../src/headless/artifact";
import { renderPdf } from "../src/pdf/render";
import type { Form } from "@paradoc/types";

it("uses one artifact override for preview fields, computed values, parties and PDF", async () => {
  const formatter = createFormatter({ overrides: { money: () => "Custom amount", person: () => "Custom person" } });
  const artifact = { name: "format", fields: { amount: { type: "money" } },
    defs: { total: { type: "money", value: { amount: "fields.amount.amount", currency: "fields.amount.currency" } } },
    parties: { owner: { label: "Owner", partyType: "person" } } } as unknown as Form;
  const data = { fields: { amount: { amount: 12, currency: "USD" } }, parties: { owner: { name: "Ada" } } };
  function Total() { return <span>{useTotals(["total"])[0]?.text}</span>; }
  const element = <Document artifact={artifact} data={data} format={{ formatter }}><Field path="amount" /><Total /><Signature party="owner" /></Document>;
  const markup = renderToStaticMarkup(element);
  expect(markup.match(/Custom amount/g)).toHaveLength(2);
  expect(markup).toContain("Custom person");
  const { bytes } = await renderPdf(element, { formatter, adapter: "chromium" });
  const text = (await pageTextRuns(bytes)).flatMap((page) => page.runs.map((run) => run.text)).join("");
  expect(text.match(/Custom amount/g)).toHaveLength(2);
  expect(text).toContain("Custom person");
}, 30_000);
