// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import { DOCUMENT_FONT_NAME } from "../src/lib/font";
import { useFontReadiness } from "../src/headless/pagination";

afterEach(() => {
  Object.defineProperty(document, "fonts", { value: undefined, configurable: true });
});

it("exposes font loading rejection instead of leaving pagination pending", async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const failure = new Error("font unavailable");
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { load: vi.fn().mockRejectedValue(failure), ready: Promise.resolve() },
  });
  const host = document.createElement("div");
  const root = createRoot(host);
  function Probe() {
    const state = useFontReadiness(DOCUMENT_FONT_NAME);
    return <span>{state.error?.message ?? (state.ready ? "ready" : "pending")}</span>;
  }
  await act(async () => { root.render(<Probe />); });
  expect(host.textContent).toBe("font unavailable");
  await act(async () => root.unmount());
});
