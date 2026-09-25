/**
 * What an image promises, proved on the PDF path rather than on the markup.
 *
 * A picture that renders in a browser and not in a PDF is the failure mode the
 * component exists to close, so the happy paths here render real bytes through
 * the default engine and read the pages back with pdfjs: the assertion is that
 * a reader opening the file sees the picture, not that the tree carried an
 * `<img>`. The failures are asserted on both seams the specification names —
 * the check, which never renders, and the render itself.
 */
/** @jsxRuntime classic */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { checkElement } from "@paradoc/react-pdf/check";
import { MissingImageSizeError, UndecodableImageError } from "@paradoc/react";
import { renderPdf } from "@paradoc/react-pdf";

import { Document } from "../src/components/document";
import { Field } from "../src/components/field";
import { Image } from "../src/components/image";
import { proposalForm } from "../src/examples/proposal";
import { shortProposalData } from "../src/examples/proposal-data";
import {
  sitePhotoAttachment,
  sitePhotoBytes,
  sitePhotoDataUri,
  surveyReportAttachment,
} from "../src/examples/sample-image";
import { readPdf } from "../../react-pdf/tests/pdf-reader";

/**
 * PDF points per CSS pixel. A composition declares a picture's size in pixels
 * at 96 dpi and a PDF measures in points at 72, so the page's own numbers are
 * the declared ones scaled by this.
 */
const PT_PER_PX = 72 / 96;

/** Bytes no renderer decodes: a note, not a picture. */
const NOT_A_PICTURE = new TextEncoder().encode("this is a note, not a picture");

/** A proposal whose annex slots are filled exactly as a caller chooses. */
function proposalWith(annexes: Record<string, { name: string; mimeType: string }>) {
  return { ...shortProposalData, annexes };
}

/**
 * The two pictures the composition places: one from bytes, one from an annex.
 *
 * Both are declared 160 wide by 120 tall, deliberately against the sample
 * photograph's own 1:1 shape, so a render that fell back to the picture's
 * intrinsic size would draw a square and be caught.
 */
function TwoImages() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="two-images">
      <Image bytes={sitePhotoBytes} width={160} height={120} alt="Harbor yard" keepId="mark" />
      <Field path="annexes.sitePhoto" as="image" width={160} height={120} />
    </Document>
  );
}

describe("an image on the PDF path", () => {
  it("paints both a bytes image and an attachment image on the page", async () => {
    const rendered = await renderPdf(<TwoImages />, {
      // Only the attachment needs bytes supplied: the other picture carries
      // its own, which is the whole difference between the two sources.
      images: [{ src: sitePhotoAttachment.name, data: sitePhotoBytes }],
    });
    const pages = await readPdf(rendered.bytes);

    expect(pages).toHaveLength(1);
    expect(pages[0]?.imageCount).toBe(2);
    // The declared box, not the picture's own square shape.
    const declared = { width: 160 * PT_PER_PX, height: 120 * PT_PER_PX };
    expect(pages[0]?.images).toEqual([declared, declared]);
  });

  it("declares the size inline as well, because a browser ignores the attributes", () => {
    // Tailwind's preflight sets `img { max-width: 100%; height: auto }`, and an
    // author rule beats a presentational hint, so the attributes alone would
    // leave the preview drawing a shape the PDF does not.
    const html = renderToStaticMarkup(<TwoImages />);

    expect(html.match(/style="width:160px;height:120px"/g)).toHaveLength(2);
  });

  it("paints nothing extra when neither image is placed", async () => {
    const rendered = await renderPdf(
      <Document artifact={proposalForm} data={shortProposalData} id="no-images">
        <Field path="proposalNumber" />
      </Document>
    );
    const pages = await readPdf(rendered.bytes);

    expect(pages[0]?.imageCount).toBe(0);
  });

  it("fails by name when the bytes are not an encoding any renderer decodes", async () => {
    await expect(
      renderPdf(
        <Document artifact={proposalForm} data={shortProposalData} id="bad-bytes">
          <Image bytes={NOT_A_PICTURE} width={40} height={40} keepId="mark" />
        </Document>
      )
    ).rejects.toThrow(UndecodableImageError);
  });

  it("fails by name when a source has no bytes behind it", async () => {
    await expect(
      renderPdf(
        <Document artifact={proposalForm} data={shortProposalData} id="no-bytes">
          <Image src="site-photo.png" width={40} height={40} keepId="mark" />
        </Document>
      )
    ).rejects.toThrow(/site-photo\.png/);
  });
});

describe("the check, which renders nothing", () => {
  it("reports a source with no bytes behind it and passes an embedded one", async () => {
    const missing = await checkElement(
      <Document artifact={proposalForm} data={shortProposalData} id="check-missing">
        <Image src="site-photo.png" width={40} height={40} keepId="mark" />
      </Document>
    );
    expect(missing.missingImages).toEqual(["site-photo.png"]);

    const embedded = await checkElement(
      <Document artifact={proposalForm} data={shortProposalData} id="check-embedded">
        <Image bytes={sitePhotoBytes} width={40} height={40} keepId="mark" />
      </Document>
    );
    expect(embedded.missingImages).toEqual([]);
  });

  it("fails by name on bytes no renderer decodes", async () => {
    await expect(
      checkElement(
        <Document artifact={proposalForm} data={shortProposalData} id="check-bad-bytes">
          <Image bytes={NOT_A_PICTURE} width={40} height={40} keepId="mark" />
        </Document>
      )
    ).rejects.toThrow(UndecodableImageError);
  });

  it("reports an attachment asked to be drawn that is not a picture", async () => {
    const mismatch = await checkElement(
      <Document artifact={proposalForm} data={shortProposalData} id="check-mismatch">
        <Field path="annexes.surveyReport" as="image" width={40} height={40} />
      </Document>
    );
    expect(mismatch.unresolvedPaths).toEqual(["image:annexes.surveyReport"]);

    const picture = await checkElement(
      <Document artifact={proposalForm} data={shortProposalData} id="check-picture">
        <Field path="annexes.sitePhoto" as="image" width={40} height={40} />
      </Document>
    );
    expect(picture.unresolvedPaths).toEqual([]);
    // The attachment's file name is the key a render supplies its bytes under,
    // so it is a source with nothing behind it until one does.
    expect(picture.missingImages).toEqual([sitePhotoAttachment.name]);
  });

  it("reports an annex slot the artifact does not declare", async () => {
    const unknown = await checkElement(
      <Document artifact={proposalForm} data={shortProposalData} id="check-unknown-annex">
        <Field path="annexes.floorPlan" as="image" width={40} height={40} />
      </Document>
    );
    expect(unknown.unresolvedPaths).toEqual(["annexes.floorPlan"]);
  });
});

describe("an attachment field", () => {
  it("draws a picture and prints the file name of anything else", () => {
    const html = renderToStaticMarkup(
      <Document artifact={proposalForm} data={shortProposalData} id="attachment-field">
        <Field path="annexes.sitePhoto" as="image" width={160} height={120} src={sitePhotoDataUri} />
        <Field path="annexes.surveyReport" as="image" width={160} height={120} />
      </Document>
    );

    expect(html).toContain(`src="${sitePhotoDataUri}"`);
    expect(html).toContain('width="160"');
    expect(html).toContain('height="120"');
    expect(html).toContain(surveyReportAttachment.name);
    expect(html).not.toContain(`src="${surveyReportAttachment.name}"`);
  });

  it("takes its heading from the annex slot's own title, and the caller may replace or hide it", () => {
    const own = renderToStaticMarkup(
      <Document artifact={proposalForm} data={shortProposalData} id="annex-heading">
        <Field path="annexes.sitePhoto" as="image" width={40} height={40} src={sitePhotoDataUri} />
      </Document>
    );
    expect(own).toContain(">Site photograph<");

    const hidden = renderToStaticMarkup(
      <Document artifact={proposalForm} data={shortProposalData} id="annex-no-heading">
        <Field path="annexes.sitePhoto" as="image" label={false} width={40} height={40} src={sitePhotoDataUri} />
      </Document>
    );
    // The heading is gone; the slot's title is still the picture's accessible
    // name, which is not something `label={false}` is asking to take away.
    expect(hidden).not.toContain(">Site photograph<");
    expect(hidden).toContain('alt="Site photograph"');
  });

  it("prints the blank placeholder for a declared slot nothing is attached to", () => {
    const html = renderToStaticMarkup(
      <Document artifact={proposalForm} data={proposalWith({})} id="annex-empty">
        <Field path="annexes.sitePhoto" as="image" width={40} height={40} />
      </Document>
    );
    expect(html).toContain("Site photograph");
    expect(html).not.toContain("<img");
  });

  it("fails by name with no declared size, whatever the slot holds", () => {
    const noSize = (id: string, path: string) =>
      renderToStaticMarkup(
        <Document artifact={proposalForm} data={id === "empty" ? proposalWith({}) : shortProposalData} id={id}>
          <Field path={path} as="image" />
        </Document>
      );

    expect(() => noSize("picture", "annexes.sitePhoto")).toThrow(MissingImageSizeError);
    // The two cases a size that was only checked against the drawn picture
    // would let through, and then throw on the day real data arrived.
    expect(() => noSize("empty", "annexes.sitePhoto")).toThrow(MissingImageSizeError);
    expect(() => noSize("not-a-picture", "annexes.surveyReport")).toThrow(MissingImageSizeError);
  });

  it("fails by name when the slot holds something that is not an attachment", () => {
    expect(() =>
      renderToStaticMarkup(
        <Document
          artifact={proposalForm}
          // A slot filled with a bare string rather than an attachment: the
          // shared formatter rejects it, and the binding says so rather than
          // printing a blank.
          data={{ ...shortProposalData, annexes: { sitePhoto: "harbor-yard.png" } } as never}
          id="annex-malformed"
        >
          <Field path="annexes.sitePhoto" as="image" width={40} height={40} />
        </Document>
      )
    ).toThrow(/sitePhoto/);
  });
});
