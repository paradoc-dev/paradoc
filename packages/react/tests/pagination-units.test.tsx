// @vitest-environment jsdom
/**
 * The pagination rule, checked against a real DOM.
 *
 * `Pages` selects `[data-keep-id]` in document order and assigns those elements
 * between pages. That only works if a keep never contains another keep, which
 * is a tree property, so this file parses the markup rather than matching it.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProposalDocument, overflowProposalData, shortProposalData } from "../../components/src/examples";

function parse(markup: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = markup;
  return host;
}

describe.each([
  ["the short set", shortProposalData],
  ["the overflow set", overflowProposalData],
])("%s", (_name, data) => {
  const host = parse(renderToStaticMarkup(<ProposalDocument data={data} />));
  const keeps = [...host.querySelectorAll("[data-keep-id]")];

  it("marks every keep", () => {
    expect(keeps.length).toBeGreaterThan(10);
  });

  it("never nests one keep inside another", () => {
    for (const element of keeps) {
      const enclosing = element.parentElement?.closest("[data-keep-id]");
      expect(
        enclosing,
        `keep "${element.getAttribute("data-keep-id")}" sits inside keep "${enclosing?.getAttribute("data-keep-id")}"`
      ).toBeNull();
    }
  });

  it("gives every keep a unique id", () => {
    const ids = keeps.map((element) => element.getAttribute("data-keep-id"));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("treats sections as containers, never as keeps", () => {
    const sections = [...host.querySelectorAll("[data-section]")];
    expect(sections.length).toBeGreaterThan(0);
    for (const section of sections) {
      expect(section.hasAttribute("data-keep-id")).toBe(false);
      expect(section.querySelectorAll("[data-keep-id]").length).toBeGreaterThan(0);
    }
  });

  it("leaves no rendered text outside a keep", () => {
    for (const element of keeps) element.remove();
    expect(host.textContent?.trim()).toBe("");
  });
});
