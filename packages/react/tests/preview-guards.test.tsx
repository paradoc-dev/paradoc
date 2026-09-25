// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";

import { DrawnPaperProvider, drawnPaper } from "../src/components/paper-geometry";
import {
  RootTokenMismatchError,
  markDocumentRoot,
  useDocumentRootTokens,
} from "../src/components/tokens-context";
import { useFurnitureFit } from "../src/headless/paper";
import { captureApplicationFonts } from "../src/lib/application-fonts";
import {
  MultipleDocumentRootsError,
  documentTokensOf,
} from "../src/lib/document-tokens";
import { PageFurnitureOverflowError } from "../src/lib/furniture";
import { resolveDocumentTokens } from "../src/lib/tokens";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const Root = markDocumentRoot(function Root(_props: { tokens?: { pageSize?: "letter" | "a4" } }) { return null; });

describe("document token guards", () => {
  it("resolves one marked root", () => {
    expect(documentTokensOf(<Root tokens={{ pageSize: "a4" }} />).pageSize).toBe("a4");
  });

  it("rejects more than one root", () => {
    expect(() => documentTokensOf(<><Root /><Root /></>)).toThrow(MultipleDocumentRootsError);
  });

  it("accepts matching drawn and root tokens", () => {
    function Probe() { useDocumentRootTokens({ pageSize: "a4" }); return null; }
    const tokens = resolveDocumentTokens({ pageSize: "a4" });
    expect(() => renderToStaticMarkup(<DrawnPaperProvider value={drawnPaper(tokens)}><Probe /></DrawnPaperProvider>)).not.toThrow();
  });

  it("rejects a root whose tokens disagree with its drawn paper", () => {
    function Probe() { useDocumentRootTokens({ pageSize: "a4" }); return null; }
    const tokens = resolveDocumentTokens({ pageSize: "letter" });
    expect(() => renderToStaticMarkup(<DrawnPaperProvider value={drawnPaper(tokens)}><Probe /></DrawnPaperProvider>)).toThrow(RootTokenMismatchError);
  });
});

describe("application font capture guards", () => {
  it("accepts a generic family with no font resource", async () => {
    const root = document.createElement("div");
    root.style.fontFamily = "sans-serif";
    await expect(captureApplicationFonts(root)).resolves.toMatchObject({ resources: [] });
  });

  it("rejects a named family with no embeddable face", async () => {
    const root = document.createElement("div");
    root.style.fontFamily = "MissingFace";
    await expect(captureApplicationFonts(root)).rejects.toThrow(/No embeddable/);
  });
});

describe("furniture fit guards", () => {
  let callbacks: Array<() => void>;
  beforeEach(() => {
    callbacks = [];
    globalThis.ResizeObserver = class {
      constructor(callback: () => void) { callbacks.push(callback); }
      observe() {}
      disconnect() {}
      unobserve() {}
    } as unknown as typeof ResizeObserver;
  });

  async function fitAt(height: number): Promise<PageFurnitureOverflowError | null> {
    let latest: PageFurnitureOverflowError | null = null;
    function Probe() {
      const fit = useFurnitureFit(72);
      latest = fit.error;
      return <div ref={fit.measureRef}><div data-page-header="true">Header</div></div>;
    }
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => root.render(<Probe />));
    const header = host.querySelector("[data-page-header]");
    Object.defineProperty(header, "getBoundingClientRect", { value: () => ({ height }) });
    await act(async () => callbacks.forEach((callback) => callback()));
    await act(async () => root.unmount());
    return latest;
  }

  it("accepts a band that fits its margin", async () => {
    expect(await fitAt(20)).toBeNull();
  });

  it("reports a band that exceeds its margin", async () => {
    expect(await fitAt(100)).toBeInstanceOf(PageFurnitureOverflowError);
  });
});
