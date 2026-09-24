/**
 * An image annex drawn by a composition, through the React layer and the seal.
 *
 * Core fills the annex slot and hands the renderer the annexes beside the
 * fields. The composition reads them from `data.annexes`, which is where
 * `<Field as="image" path="annexes.<slot>">` looks. If the renderer drops them,
 * the field draws its blank placeholder and the PDF carries no image, so the
 * criterion is an image in the PDF of every pass.
 */

import type { Attachment } from "@paradoc/types";
import { beforeEach, describe, expect, it } from "vitest";

import { Document } from "../../components/src/components/document";
import { Field } from "../../components/src/components/field";
import { Signature } from "../../components/src/components/signature";
import {
  PROPOSAL_REACT_LAYER,
  PROPOSAL_REACT_LAYER_PATH,
  proposal,
  shortProposalData,
  sitePhotoAttachment,
  sitePhotoBytes,
} from "../../components/src/examples";
import { fillProposalForSeal } from "../../components/src/examples/pdf";
import { reactLayerRenderers, type ReactLayerComponentProps } from "../src/layer";
import { readPdf } from "./pdf-reader";

/** The annexes each render handed the composition, one entry per render. */
let received: (Record<string, Attachment> | undefined)[];

function AnnexComposition({ artifact, data }: ReactLayerComponentProps) {
  received.push(data.annexes);
  return (
    <Document artifact={artifact} data={data} id="annex-composition">
      <Field path="annexes.sitePhoto" as="image" width={160} height={120} />
      <Signature party="provider" />
      <Signature party="customer" />
    </Document>
  );
}

const renderers = reactLayerRenderers({
  components: {
    [PROPOSAL_REACT_LAYER_PATH]: AnnexComposition,
    [PROPOSAL_REACT_LAYER]: AnnexComposition,
  },
  pdf: { images: [{ src: sitePhotoAttachment.name, data: sitePhotoBytes }] },
});

/** How many pages of the PDF paint an image. The composition is one page. */
async function pagesWithImage(bytes: Uint8Array): Promise<number> {
  return (await readPdf(bytes)).filter((page) => page.hasImage).length;
}

beforeEach(() => {
  received = [];
});

describe("an image annex through the React layer", () => {
  it("reaches the composition as data.annexes and draws in a layer render", async () => {
    const filled = proposal.fill({
      fields: shortProposalData.fields,
      parties: shortProposalData.parties,
      annexes: { sitePhoto: sitePhotoAttachment },
    } as Parameters<typeof proposal.fill>[0]);

    const bytes = (await filled.render({ renderers })) as Uint8Array;

    expect(received).toEqual([{ sitePhoto: sitePhotoAttachment }]);
    expect(await pagesWithImage(bytes)).toBe(1);
  }, 60_000);

  it("draws no image when the slot is empty", async () => {
    const filled = proposal.fill({
      fields: shortProposalData.fields,
      parties: shortProposalData.parties,
    } as Parameters<typeof proposal.fill>[0]);

    const bytes = (await filled.render({ renderers })) as Uint8Array;

    expect(received).toEqual([undefined]);
    expect(await pagesWithImage(bytes)).toBe(0);
  }, 60_000);

  it("reaches both seal passes and stays in the sealed PDF", async () => {
    const sealed = await fillProposalForSeal(shortProposalData).seal({ renderers });

    // The marker pass and the clean pass each render the composition.
    expect(received).toEqual([shortProposalData.annexes, shortProposalData.annexes]);
    expect(received[0]).toHaveProperty("sitePhoto", sitePhotoAttachment);
    expect(sealed.signatureMap).toHaveLength(2);
    expect(await pagesWithImage(sealed.canonicalPdfBytes!)).toBe(1);
  }, 120_000);
});
