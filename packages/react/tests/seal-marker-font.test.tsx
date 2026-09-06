/**
 * Why the seal path embeds a second face, in its own file.
 *
 * Core places a flow-positioned slot by writing eight braille codepoints in
 * front of the placeholder and finding them again in the PDF's text. The engine
 * writes U+0000 for a codepoint no embedded font covers, and Inter covers no
 * braille, so a document rendered with the document face alone loses the marker.
 * The React renderer embeds a braille face on any pass that carries a marker,
 * and checks the marker arrived, so the loss now fails naming the slot and the
 * coverage rather than surfacing two steps later as an unlocatable placement.
 *
 * The engine's font registry is global to the process: once a render embeds the
 * marker face, every later render in that process can reach it. The unmarked
 * cases therefore have to run before any marked one, which is why this file
 * holds them alone and asserts them first, and why the package's vitest config
 * states `isolate: true` rather than inheriting it.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { overflowProposalData, PROPOSAL_SIGNATURE_SLOTS } from "../src/examples";
import { fillProposalForSeal, proposalLogoImage, proposalRenderers } from "../src/examples/pdf";
import { MissingSigningMarkerError, renderPdf, type PdfImage } from "../src/pdf";
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

  it("second, without it: the seal fails naming every slot and the coverage", async () => {
    // The headline finding, as a test rather than a transcription. Nothing here
    // is stubbed: core runs its own flow against the real renderer, with the
    // marker face turned off. The failure now names the cause, which is the
    // acceptance criterion for this ticket.
    expect.assertions(5);
    try {
      await fillProposalForSeal(overflowProposalData).seal({
        renderers: proposalRenderers({ images: [logo], pdf: { signingMarkers: false } }),
      });
    } catch (error) {
      expect(error).toBeInstanceOf(MissingSigningMarkerError);
      const failed = error as MissingSigningMarkerError;
      expect([...failed.slots].sort()).toEqual([...Object.values(PROPOSAL_SIGNATURE_SLOTS)].sort());
      // Named: every slot, the glyph coverage, and the option that fixes it.
      for (const slot of Object.values(PROPOSAL_SIGNATURE_SLOTS)) {
        expect(failed.message).toContain(slot);
      }
      expect(failed.message).toMatch(/glyph coverage/);
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
      renderers: proposalRenderers({ images: [logo] }),
    });
    expect(sealed.signatureMap).toHaveLength(2);
  }, 120_000);
});
