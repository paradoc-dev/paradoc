/**
 * Why the seal path embeds a second face, in its own file.
 *
 * Core places a flow-positioned slot by writing eight braille codepoints in
 * front of the placeholder and finding them again in the converted PDF's text.
 * The engine writes U+0000 for a codepoint no embedded font covers, and Inter
 * covers no braille, so a document rendered with the document face alone loses
 * the marker and the seal fails on placement with nothing naming the cause.
 * `renderPdf({ signingMarkers: true })` embeds a braille face as a coverage
 * subset of the same family and the marker survives.
 *
 * The engine's font registry is global to the process: once a render embeds the
 * marker face, every later render in that process can reach it. The unmarked
 * cases therefore have to run before any marked one, which is why this file
 * holds them alone and asserts them first, and why the package's vitest config
 * states `isolate: true` rather than inheriting it.
 */

import { LocateError } from "@paradoc/render/pdf";
import { beforeAll, describe, expect, it } from "vitest";
import { overflowProposalData, PROPOSAL_SIGNATURE_SLOTS } from "../src/examples";
import { fillProposalForSeal, proposalLogoImage, proposalSealAdapter } from "../src/examples/pdf";
import { renderPdf, type PdfImage } from "../src/pdf";
import { SIGNATURE_RULE } from "../src/components/signature";
import { readPdf } from "./pdf-reader";

/** Core's marker for signer index 1, a signature field: eight braille codepoints. */
const MARKER = "⠀⠀⠀⠀⠀⠁⠀⠀";
const NUL = "\u0000";

const tree = (
  <div className="flex flex-col text-sm">
    <span data-keep-id="mark">{MARKER + SIGNATURE_RULE}</span>
  </div>
);

let logo: PdfImage;

beforeAll(async () => {
  logo = await proposalLogoImage();
}, 60_000);

describe("the marker face the seal flow needs", () => {
  it("first, without it: the marker reaches the PDF as nulls", async () => {
    const page = (await readPdf((await renderPdf(tree)).bytes))[0]!;
    expect(page.text).toContain(NUL);
    expect(page.text).not.toContain(MARKER);
    expect(page.text).toContain(SIGNATURE_RULE);
  }, 120_000);

  it("second, without it: the seal fails on placement, naming every slot", async () => {
    // The headline finding, as a test rather than a transcription. Nothing here
    // is stubbed: core runs its own flow and its own locator, against a
    // converter that renders the real document without the marker face.
    const bare = proposalSealAdapter({
      data: overflowProposalData,
      images: [logo],
      signingMarkers: false,
    });

    expect.assertions(4);
    try {
      await fillProposalForSeal(overflowProposalData).seal({ adapter: bare });
    } catch (error) {
      expect(error).toBeInstanceOf(LocateError);
      const failures = (error as LocateError).failures;
      expect(failures.map((failure) => failure.id).sort()).toEqual(
        [...Object.values(PROPOSAL_SIGNATURE_SLOTS)].sort()
      );
      expect(failures.every((failure) => failure.reason === "missing")).toBe(true);
      // Nothing in the message points at a font, which is the finding.
      expect((error as LocateError).message).not.toMatch(/font/i);
    }
  }, 120_000);

  it("then, with it: the marker survives and the placeholder is unchanged", async () => {
    const page = (await readPdf((await renderPdf(tree, { signingMarkers: true })).bytes))[0]!;
    expect(page.text).toContain(MARKER);
    expect(page.text).not.toContain(NUL);
    expect(page.text).toContain(SIGNATURE_RULE);
  }, 120_000);

  it("and the whole seal then resolves both slots", async () => {
    const sealed = await fillProposalForSeal(overflowProposalData).seal({
      adapter: proposalSealAdapter({ data: overflowProposalData, images: [logo] }),
    });
    expect(sealed.signatureMap).toHaveLength(2);
  }, 120_000);
});
