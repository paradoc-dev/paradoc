// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { usePagination, type PaginationBinding } from "../src/headless/pagination";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("pagination errors", () => {
  it("reports a planning error through the binding", async () => {
    let latest: PaginationBinding | undefined;
    function Probe() {
      latest = usePagination({ budget: 1000 });
      return <div ref={latest.measureRef}><div data-keep-id="duplicate">A</div><div data-keep-id="duplicate">B</div></div>;
    }
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => { root.render(<Probe />); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(latest?.error?.message).toMatch(/duplicated/);
    await act(async () => root.unmount());
  });
});
