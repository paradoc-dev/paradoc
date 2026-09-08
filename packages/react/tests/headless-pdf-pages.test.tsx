// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { paints, paintPdfPages } = vi.hoisted(() => {
  const paints: Array<{ resolve(value: unknown): void; reject(error: Error): void }> = [];
  return { paints, paintPdfPages: vi.fn(() => new Promise((resolve, reject) => paints.push({ resolve, reject }))) };
});

vi.mock("../src/lib/pdf-painter", async (original) => {
  const actual = await original<typeof import("../src/lib/pdf-painter")>();
  return { ...actual, paintPdfPages };
});

import { usePdfPages, type PdfPagesBinding } from "../src/headless/packet";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  paints.length = 0;
  paintPdfPages.mockClear();
  host = document.createElement("div");
  root = createRoot(host);
});
afterEach(() => act(() => root.unmount()));

function Probe({ bytes, publish }: { bytes: Uint8Array; publish(value: PdfPagesBinding): void }) {
  const value = usePdfPages({ bytes, filename: "part.pdf" });
  useEffect(() => publish(value), [value, publish]);
  return null;
}

describe("the optional PDF lifecycle", () => {
  it("ignores a late result after replacement", async () => {
    const seen: PdfPagesBinding[] = [];
    const publish = (value: PdfPagesBinding) => { seen.push(value); };
    await act(async () => root.render(<Probe bytes={new Uint8Array([1])} publish={publish} />));
    await act(async () => root.render(<Probe bytes={new Uint8Array([2])} publish={publish} />));
    await act(async () => paints[0]!.resolve([{ pageNumber: 1, widthPx: 10, heightPx: 10, src: "old" }]));
    expect(seen.some((value) => value.pages.some((page) => page.src === "old"))).toBe(false);
    await act(async () => paints[1]!.resolve([{ pageNumber: 1, widthPx: 10, heightPx: 10, src: "new" }]));
    expect(seen.at(-1)?.pages[0]?.src).toBe("new");
  });

  it("publishes a useful attachment reason on failure", async () => {
    const seen: PdfPagesBinding[] = [];
    await act(async () => root.render(<Probe bytes={new Uint8Array([1])} publish={(value) => { seen.push(value); }} />));
    await act(async () => paints[0]!.reject(new Error("worker timed out")));
    expect(seen.at(-1)).toMatchObject({ status: "attached", pages: [] });
    expect(seen.at(-1)?.attachmentReason).toContain("worker timed out");
  });

  it("does not publish after unmount", async () => {
    const seen: PdfPagesBinding[] = [];
    const publish = (value: PdfPagesBinding) => { seen.push(value); };
    await act(async () => root.render(<Probe bytes={new Uint8Array([1])} publish={publish} />));
    const before = seen.length;
    await act(async () => root.unmount());
    await act(async () => paints[0]!.resolve([{ pageNumber: 1, widthPx: 10, heightPx: 10, src: "late" }]));
    expect(seen).toHaveLength(before);
    root = createRoot(host);
  });
});
