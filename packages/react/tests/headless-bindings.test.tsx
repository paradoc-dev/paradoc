// @vitest-environment jsdom

import { act, memo, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { createFormatter } from "@paradoc/format";
import { describe, expect, it, vi } from "vitest";

import {
  ArtifactProvider,
  CompositeFieldPathError,
  InvalidFieldPathError,
  InvalidListValueError,
  UnknownDefinitionError,
  UnknownPartyRoleError,
  readValue,
  resolveField,
  useField,
  useList,
  useParty,
  useTotals,
} from "../src";
import { purchaseOrderData } from "../../components/src/examples/purchase-order-data";
import { purchaseOrderForm } from "../../components/src/examples/purchase-order";

function BoundSummary() {
  const number = useField("orderNumber");
  const items = useList("lineItems");
  const totals = useTotals(["subtotal", "total"]);
  return <p>{number.text}|{items.text(0, "description")}|{totals.map((total) => total.text).join("|")}</p>;
}

function OneField({ path }: { path: string }) {
  return <span>{useField(path).text}</span>;
}

describe("a composite path is a fault, not a placeholder", () => {
  it("refuses a list path and a fieldset path, naming the bindings that do carry them", () => {
    const bind = (path: string) =>
      renderToStaticMarkup(
        <ArtifactProvider artifact={purchaseOrderForm} data={purchaseOrderData}>
          <OneField path={path} />
        </ArtifactProvider>
      );
    expect(() => bind("lineItems")).toThrow(CompositeFieldPathError);
    expect(() => bind("lineItems")).toThrow(/lineItems.*list.*useList\(\)\/<Table>.*useParty\(\)\/<Signature>/s);
    expect(() => bind("lineItems.0")).toThrow(CompositeFieldPathError);
    expect(() => bind("lineItems.0")).toThrow(/fieldset/);
  });

  it("still binds a field inside the composite, and the list binding still reads its rows", () => {
    const html = renderToStaticMarkup(
      <ArtifactProvider artifact={purchaseOrderForm} data={purchaseOrderData}>
        <OneField path="lineItems.0.description" />
      </ArtifactProvider>
    );
    expect(html).toContain("27-inch 4K monitor");
    expect(
      renderToStaticMarkup(
        <ArtifactProvider artifact={purchaseOrderForm} data={purchaseOrderData}>
          <BoundSummary />
        </ArtifactProvider>
      )
    ).toContain("27-inch 4K monitor");
  });
});

describe("headless artifact bindings", () => {
  it("renders field, list and computed outputs in SSR without adding provider markup", () => {
    const html = renderToStaticMarkup(
      <ArtifactProvider artifact={purchaseOrderForm} data={purchaseOrderData}>
        <BoundSummary />
      </ArtifactProvider>
    );
    expect(html).toContain("PO-2026-0512");
    expect(html).toContain("27-inch 4K monitor");
    expect(html).toContain("$131,811.70");
    expect(html.startsWith("<p>")).toBe(true);
  });

  it("honors custom formatter identity and progressive partial values", () => {
    const formatter = createFormatter({ locale: "de-DE" });
    const custom = renderToStaticMarkup(
      <ArtifactProvider artifact={purchaseOrderForm} data={purchaseOrderData} format={{ formatter }}>
        <BoundSummary />
      </ArtifactProvider>
    );
    expect(custom).toContain("131.811,70");
    const partial = { ...purchaseOrderData, fields: { ...purchaseOrderData.fields, orderNumber: undefined } };
    const html = renderToStaticMarkup(
      <ArtifactProvider artifact={purchaseOrderForm} data={partial} format={{ partial: true, blank: "pending" }}>
        <BoundSummary />
      </ArtifactProvider>
    );
    expect(html).toContain("pending");
  });

  it("reports a value that printed blank, including one the data is not missing", () => {
    // `blank` is what a component asks before it draws something else in place
    // of the placeholder — a fill line on a form printed to be written on. It
    // is not "the value is nullish": a money value whose amount has not been
    // answered yet is a value, and it prints blank.
    function Blankness({ path }: { path: string }) {
      const binding = useField(path);
      return <p>{`${binding.text}|${binding.blank}|${binding.value === undefined}`}</p>;
    }
    const answered = renderToStaticMarkup(
      <ArtifactProvider artifact={purchaseOrderForm} data={purchaseOrderData}>
        <Blankness path="orderNumber" />
      </ArtifactProvider>
    );
    expect(answered).toBe("<p>PO-2026-0512|false|false</p>");

    const rows = purchaseOrderData.fields.lineItems as Record<string, unknown>[];
    const unpriced = {
      ...purchaseOrderData,
      fields: {
        ...purchaseOrderData.fields,
        orderNumber: undefined,
        lineItems: [{ ...rows[0], unitPrice: { amount: null, currency: "USD" } }, ...rows.slice(1)],
      },
    };
    const partial = (path: string) =>
      renderToStaticMarkup(
        <ArtifactProvider artifact={purchaseOrderForm} data={unpriced} format={{ partial: true }}>
          <Blankness path={path} />
        </ArtifactProvider>
      );
    // Missing outright: blank, and the data has nothing there.
    expect(partial("orderNumber")).toBe("<p>\u2014|true|true</p>");
    // Half-supplied: blank, and the data has something there.
    expect(partial("lineItems.0.unitPrice")).toBe("<p>\u2014|true|false</p>");
  });

  it("keeps a focused subscriber stable for an unrelated immutable update", async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const node = document.createElement("div");
    const root = createRoot(node);
    const renders = vi.fn();
    const NumberField = memo(function NumberField() {
      renders();
      return <span>{useField("orderNumber").text}</span>;
    });
    const render = (data: typeof purchaseOrderData) => root.render(
      <StrictMode><ArtifactProvider artifact={purchaseOrderForm} data={data}><NumberField /></ArtifactProvider></StrictMode>
    );
    await act(async () => render(purchaseOrderData));
    const initial = renders.mock.calls.length;
    await act(async () => render({ ...purchaseOrderData, fields: { ...purchaseOrderData.fields, terms: "Changed" } }));
    expect(renders).toHaveBeenCalledTimes(initial);
    await act(async () => render({ ...purchaseOrderData, fields: { ...purchaseOrderData.fields, orderNumber: "PO-NEW" } }));
    expect(renders.mock.calls.length).toBeGreaterThan(initial);
    expect(node.textContent).toBe("PO-NEW");
    await act(async () => root.unmount());
  });

  it("rejects unknown definitions and non-array list values coherently", () => {
    function UnknownTotal() { useTotals(["missing"]); return null; }
    expect(() => renderToStaticMarkup(<ArtifactProvider artifact={purchaseOrderForm} data={purchaseOrderData}><UnknownTotal /></ArtifactProvider>)).toThrow(UnknownDefinitionError);
    function InvalidList() { useList("lineItems"); return null; }
    const data = { ...purchaseOrderData, fields: { ...purchaseOrderData.fields, lineItems: "wrong" } };
    expect(() => renderToStaticMarkup(<ArtifactProvider artifact={purchaseOrderForm} data={data}><InvalidList /></ArtifactProvider>)).toThrow(InvalidListValueError);
    function UnknownParty() { useParty("missing"); return null; }
    expect(() => renderToStaticMarkup(<ArtifactProvider artifact={purchaseOrderForm} data={purchaseOrderData}><UnknownParty /></ArtifactProvider>)).toThrow(UnknownPartyRoleError);
  });
});

describe("field path grammar", () => {
  it.each(["", ".orderNumber", "orderNumber.", "lineItems..0", "__proto__.polluted", "constructor.name"])("rejects %j", (path) => {
    expect(() => resolveField(purchaseOrderForm, path)).toThrow(InvalidFieldPathError);
    expect(() => readValue(purchaseOrderData.fields, path)).toThrow(InvalidFieldPathError);
  });

  it("reads own properties only", () => {
    const inherited = Object.create({ orderNumber: "inherited" }) as Record<string, unknown>;
    expect(readValue(inherited, "orderNumber")).toBeUndefined();
  });
});
