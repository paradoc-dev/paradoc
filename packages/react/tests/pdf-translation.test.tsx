/**
 * The translation between the one tree and the engine's vocabulary.
 *
 * These are the seams the render call is built on, tested without rendering:
 * which classes the PDF path has verified, and what the walk does to the
 * resolved tree. A failure here says which half is wrong before a PDF is ever
 * written.
 */

import type { Node } from "@takumi-rs/helpers";
import { fromJsx } from "@takumi-rs/helpers/jsx";
import { describe, expect, it } from "vitest";
import { ProposalDocument, overflowProposalData, shortProposalData } from "../../components/src/examples";
import {
  INITIAL_VALUE_CLASSES,
  isSupportedClass,
  splitClasses,
  SUPPORTED_CLASS_FAMILIES,
  unsupportedClasses,
} from "../src/pdf/tailwind";
import { preparePdfTree } from "../src/pdf/tree";

function flatten(node: Node): Node[] {
  const found = [node];
  if (node.type === "container" && node.children) {
    for (const child of node.children) found.push(...flatten(child));
  }
  return found;
}

function byKeepId(node: Node, id: string): Node {
  const match = flatten(node).find((each) => each.attributes?.["data-keep-id"] === id);
  expect(match, `no keep "${id}" in the tree`).toBeDefined();
  return match!;
}

describe("the verified class vocabulary", () => {
  it("covers every class the composed proposal uses", async () => {
    const { node } = await fromJsx(<ProposalDocument data={shortProposalData} />);
    const offenders = flatten(node).flatMap((each) =>
      each.className ? unsupportedClasses(each.className) : []
    );
    expect(offenders).toEqual([]);
  });

  it("rejects a utility the probe suite never verified", () => {
    expect(isSupportedClass("grid-cols-3")).toBe(false);
    expect(isSupportedClass("rotate-45")).toBe(false);
    expect(isSupportedClass("backdrop-blur-sm")).toBe(false);
  });

  it("rejects every variant, because the engine has no state to vary on", () => {
    expect(isSupportedClass("hover:bg-red-500")).toBe(false);
    expect(isSupportedClass("md:flex-col")).toBe(false);
    expect(isSupportedClass("dark:text-white")).toBe(false);
  });

  it("rejects an arbitrary value, which is not in the engine's table", () => {
    expect(isSupportedClass("w-[37px]")).toBe(false);
    expect(isSupportedClass("text-[#123456]")).toBe(false);
  });

  it("accepts the families the probe suite verified", () => {
    for (const name of [
      "flex",
      "flex-col",
      "justify-between",
      "items-center",
      "self-end",
      "basis-1/12",
      "gap-0.5",
      "px-6",
      "-mt-2",
      "w-full",
      "h-px",
      "border-b",
      "border-neutral-800",
      "rounded-md",
      "text-xs",
      "text-right",
      "text-neutral-500",
      "bg-white",
      "font-semibold",
      "leading-relaxed",
      "tracking-wider",
      "uppercase",
      "whitespace-pre-line",
      "p-13",
      "gap-15",
      "border-3",
    ]) {
      expect(isSupportedClass(name), name).toBe(true);
    }
  });

  it("rejects the utilities the engine drops in silence", () => {
    // Every one of these probed byte-identical with and without. The browser
    // honours them, so admitting them would be a silent loss on paper.
    for (const name of [
      "underline",
      "line-through",
      "overline",
      "border-dashed",
      "border-dotted",
      "order-2",
      "align-middle",
      "text-ellipsis",
      "break-words",
      "break-all",
      "flex-none",
      "shrink-0",
      "grow-0",
      "min-w-fit",
      "overflow-auto",
      "break-inside-avoid",
      "break-before-page",
    ]) {
      expect(isSupportedClass(name), name).toBe(false);
    }
  });

  it("admits an initial-value class only when a family already covers it", () => {
    for (const name of INITIAL_VALUE_CLASSES) {
      expect(isSupportedClass(name), name).toBe(true);
    }
  });

  it("gives every family a probe, so none can enter the list unverified", () => {
    for (const family of SUPPORTED_CLASS_FAMILIES) {
      expect(family.pattern.test(family.probe), family.name).toBe(true);
    }
  });

  it("reports offenders in the order they appear and leaves the rest alone", () => {
    expect(unsupportedClasses("flex grid-cols-3 text-sm hover:underline")).toEqual([
      "grid-cols-3",
      "hover:underline",
    ]);
    expect(splitClasses("  flex   text-sm  ")).toEqual(["flex", "text-sm"]);
  });
});

describe("the walk over the resolved tree", () => {
  it("moves className to the property the engine reads, at every depth", async () => {
    const { node } = await fromJsx(
      <div className="flex flex-col gap-2">
        <span className="text-sm text-neutral-500">value</span>
      </div>
    );
    const prepared = preparePdfTree(node);

    expect(prepared.node.tw).toBe("flex flex-col gap-2");
    expect(prepared.node.className).toBeUndefined();

    const child = flatten(prepared.node).find((each) => each.type === "text");
    expect(child?.tw).toBe("text-sm text-neutral-500");
    expect(child?.className).toBeUndefined();
  });

  it("checks a class written as tw, not only one written as className", async () => {
    const { node } = await fromJsx(<div tw="grid-cols-3" className="flex" />);
    const prepared = preparePdfTree(node);

    expect(prepared.node.tw).toBe("grid-cols-3 flex");
    expect(prepared.unsupportedClasses).toEqual(["grid-cols-3"]);
  });

  it("keeps every keep together, which is the preview's rule in the engine's words", async () => {
    const { node } = await fromJsx(<ProposalDocument data={shortProposalData} />);
    const prepared = preparePdfTree(node, { imageSources: ["paradoc-react:proposal-logo.png"] });

    const keeps = flatten(prepared.node).filter((each) => each.attributes?.["data-keep-id"]);
    expect(keeps.length).toBeGreaterThan(10);
    for (const keep of keeps) {
      expect(keep.style?.breakInside, keep.attributes?.["data-keep-id"]).toBe("avoid");
    }
  });

  it("translates the KeepTogether wrapper the preview declares its units with", async () => {
    const { node } = await fromJsx(<ProposalDocument data={shortProposalData} />);
    const prepared = preparePdfTree(node, { imageSources: ["paradoc-react:proposal-logo.png"] });
    const keeps = flatten(prepared.node).filter((each) => each.attributes?.["data-keep-id"]);

    // `KeepTogether` renders unconditionally outside a page context, so the PDF sees
    // the whole document exactly once.
    const ids = keeps.map((each) => each.attributes?.["data-keep-id"]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe("logo");
  });

  it("carries no repeated header copies, because the PDF renders the plain document", async () => {
    const { node } = await fromJsx(<ProposalDocument data={overflowProposalData} />);
    const prepared = preparePdfTree(node, { imageSources: ["paradoc-react:proposal-logo.png"] });

    // `data-keep-repeat` marks a copy the preview's plan put on a continued
    // page. The PDF path renders the document, not `Pages`, so a copy here
    // would mean the engine was handed the same keep twice.
    const repeats = flatten(prepared.node).filter(
      (each) => each.attributes?.["data-keep-repeat"] !== undefined
    );
    expect(repeats).toEqual([]);
  });

  it("starts a new page at a hinted keep and only there", async () => {
    const { node } = await fromJsx(<ProposalDocument data={shortProposalData} />);
    const prepared = preparePdfTree(node, {
      plan: { breaks: ["line-items:2", "totals"], repeats: [[], [], []] },
      imageSources: ["paradoc-react:proposal-logo.png"],
    });

    expect(prepared.appliedBreaks).toEqual(["line-items:2", "totals"]);
    expect(byKeepId(prepared.node, "line-items:2").style?.breakBefore).toBe("page");
    expect(byKeepId(prepared.node, "totals").style?.breakBefore).toBe("page");
    expect(byKeepId(prepared.node, "line-items:1").style?.breakBefore).toBeUndefined();
  });

  it("reports a hint naming a keep that is not in the tree", async () => {
    const { node } = await fromJsx(<ProposalDocument data={shortProposalData} />);
    const prepared = preparePdfTree(node, {
      plan: { breaks: ["totals", "line-items:900"], repeats: [[], [], []] },
      imageSources: ["paradoc-react:proposal-logo.png"],
    });

    expect(prepared.appliedBreaks).toEqual(["totals"]);
    expect(prepared.unknownBreaks).toEqual(["line-items:900"]);
  });

  it("leaves the tree it was given untouched", async () => {
    const { node } = await fromJsx(<div className="flex" data-keep-id="only" />);
    const before = JSON.stringify(node);
    preparePdfTree(node, { plan: { breaks: ["only"], repeats: [[], []] } });
    expect(JSON.stringify(node)).toBe(before);
  });

  it("names an image with no bytes once, however often it appears", async () => {
    const { node } = await fromJsx(
      <div className="flex">
        <img src="logo.png" alt="" width={10} height={10} />
        <img src="logo.png" alt="" width={10} height={10} />
      </div>
    );
    expect(preparePdfTree(node).missingImages).toEqual(["logo.png"]);
  });
});
