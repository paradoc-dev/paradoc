/**
 * A missing optional peer names itself.
 *
 * `puppeteer` and `tailwindcss` are optional peers, so a caller who asks for
 * the Chromium adapter without installing them gets a module the loader cannot
 * resolve. What Node says about that is `Cannot find package 'tailwindcss'`,
 * thrown from whichever chunk happened to import it: it names neither the
 * adapter the caller asked for or the second peer they will need next.
 *
 * The load is mocked rather than staged by uninstalling a package, because the
 * failure under test is the translation, not Node's own resolution: whatever
 * the loader threw has to reach the caller intact, under an error that names
 * what to do about it.
 */

import { describe, expect, it, vi } from "vitest";

import { overflowProposalData, ProposalDocument } from "../src/examples";

vi.mock("../src/pdf/adapters/chromium", () => {
  const failure = new Error(
    "Cannot find package 'tailwindcss' imported from chunk-KRLXQBW2.js"
  ) as Error & { code: string };
  failure.code = "ERR_MODULE_NOT_FOUND";
  throw failure;
});

describe("asking for an adapter whose optional peers are missing", () => {
  it("names the adapter, both peers, and both installation paths", async () => {
    const { MissingAdapterPeerError, renderPdf } = await import("../src/pdf");

    let thrown: unknown;
    try {
      await renderPdf(<ProposalDocument data={overflowProposalData} />, { adapter: "chromium" });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(MissingAdapterPeerError);
    const error = thrown as InstanceType<typeof MissingAdapterPeerError>;

    expect(error.adapter).toBe("chromium");
    expect(error.peers).toEqual(["puppeteer", "tailwindcss"]);
    expect(error.message).toContain('The "chromium" PDF adapter could not be loaded');
    expect(error.message).toContain("@paradoc/react-pdf");
    expect(error.message).toContain("npm install puppeteer tailwindcss");
    // Whatever the loader actually said is carried through rather than
    // replaced, so the real cause stays readable and stays attached.
    expect(error.cause).toBeInstanceOf(Error);
    expect(error.message).toContain((error.cause as Error).message);
  });

  it("leaves the default adapter reachable in the same process", async () => {
    const { renderPdf } = await import("../src/pdf");
    const { proposalLogoImage } = await import("../src/examples/pdf");

    const { bytes } = await renderPdf(<ProposalDocument data={overflowProposalData} />, {
      images: [await proposalLogoImage()],
    });

    expect(bytes.length).toBeGreaterThan(0);
  }, 60_000);
});
