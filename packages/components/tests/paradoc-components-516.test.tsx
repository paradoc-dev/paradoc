// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@paradoc/essentials", () => ({
  w9: {
    safeParseData: (data: unknown) => ({ success: true, data }),
    fill: () => ({ render: () => Promise.reject(new Error("font table missing: Helvetica")) }),
  },
}));

import { VendorPacketBlockPreview } from "../src/examples/vendor-packet-block-preview";

it("shows the cause when rendering the W-9 fails", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<VendorPacketBlockPreview />));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(host.textContent).toContain("Rendering the W-9's PDF layer failed.");
  expect(host.textContent).toContain("font table missing: Helvetica");
  await act(async () => root.unmount());
  host.remove();
});
