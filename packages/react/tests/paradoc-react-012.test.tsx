// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("pagination measurement cost", () => {
  it("does not recapture fonts after an unrelated render", async () => {
    vi.resetModules();
    const fonts = await import("../src/lib/application-fonts");
    const capture = vi.spyOn(fonts, "captureApplicationFonts");
    vi.doMock("../src/lib/application-fonts", () => ({ ...fonts, captureApplicationFonts: capture }));
    const { usePagination } = await import("../src/headless/pagination");
    let bump = () => {};
    function Probe() {
      const [count, setCount] = useState(0);
      bump = () => setCount((value) => value + 1);
      const pagination = usePagination({ budget: 1000 });
      return <div data-count={count} ref={pagination.measureRef}><div data-keep-id="a">A</div></div>;
    }
    const root = createRoot(document.createElement("div"));
    await act(async () => { root.render(<Probe />); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    const afterMount = capture.mock.calls.length;
    await act(async () => bump());
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(capture).toHaveBeenCalledTimes(afterMount);
    await act(async () => root.unmount());
    vi.doUnmock("../src/lib/application-fonts");
  });

  it("caches font bytes and integrity by URL for the session", async () => {
    vi.resetModules();
    const { captureApplicationFonts } = await import("../src/lib/application-fonts");
    const fetchSpy = vi.fn(async () => new Response(new Uint8Array([0, 1, 0, 0]).buffer));
    vi.stubGlobal("fetch", fetchSpy);
    const style = document.createElement("style");
    style.textContent = "@font-face { font-family: Brand; src: url(https://fonts.example/brand.woff2); }";
    document.head.append(style);
    const host = document.createElement("div");
    host.style.fontFamily = "Brand";
    host.style.fontWeight = "400";
    host.style.fontStyle = "normal";
    host.textContent = "Hello";
    document.body.append(host);
    await captureApplicationFonts(host);
    await captureApplicationFonts(host);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
