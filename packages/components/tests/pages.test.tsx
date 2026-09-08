// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { purchaseOrderData, purchaseOrderForm } from "@paradoc/react/examples";
import { Document, Field, Pages } from "../src";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(document, "fonts", { value: undefined, configurable: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

it("paginates copy-owned furniture and publishes only a changed plan", async () => {
  const paginate = vi.fn();
  const view = (data = purchaseOrderData) => <Pages onPaginate={paginate}>
    <Document artifact={purchaseOrderForm} data={data}>
      <Field path="orderNumber" />
    </Document>
  </Pages>;
  await act(async () => root.render(view()));
  expect(paginate).toHaveBeenCalledTimes(1);
  expect(paginate.mock.calls[0]?.[0].pages).toEqual([["field:orderNumber"]]);
  expect(host.querySelector("[data-paper-sheet]")?.textContent).toContain("PO-2026-0512");
  await act(async () => root.render(view()));
  expect(paginate).toHaveBeenCalledTimes(1);
  await act(async () => root.render(view({ ...purchaseOrderData, fields: { ...purchaseOrderData.fields, orderNumber: "PO-NEW" } })));
  expect(host.querySelector("[data-paper-sheet]")?.textContent).toContain("PO-NEW");
});
