/**
 * The PDF render, read back as a reader sees it.
 *
 * Every assertion here goes through pdfjs-dist rather than through the bytes
 * the engine wrote: the criterion is a PDF with selectable text and a visible
 * logo, so the test opens the file and looks.
 *
 * The engine paginates itself here. Hint mode, where the preview's page plan
 * decides the breaks, is in `pdf-hints.test.tsx`.
 */

import { beforeAll, describe, expect, it } from "vitest";
import {
  ProposalDocument,
  overflowProposalData,
  shortProposalData,
  PROPOSAL_LOGO_SRC,
} from "../../components/src/examples";
import { PAPER_HEIGHT_PX, PAPER_WIDTH_PX } from "../src/headless/paper";
import { proposalLogoImage } from "../../components/src/examples/pdf";
import { FontResourceIdentityMismatchError, renderPdf, resolveFontResource, UnsupportedApplicationTypographyError, UnsupportedPdfContentError } from "../src/pdf";
import type { PdfAdapter, PreparedPdfInput } from "../src/pdf";
import { readPdf, type ReadPage } from "./pdf-reader";

/** CSS pixels at 96 dpi to the PDF's points at 72 dpi. */
const PX_TO_PT = 72 / 96;

let logo: Awaited<ReturnType<typeof proposalLogoImage>>;
let overflow: ReadPage[];
let short: ReadPage[];

beforeAll(async () => {
  logo = await proposalLogoImage();
  overflow = await readPdf(
    (await renderPdf(<ProposalDocument data={overflowProposalData} />, { images: [logo] })).bytes
  );
  short = await readPdf(
    (await renderPdf(<ProposalDocument data={shortProposalData} />, { images: [logo] })).bytes
  );
}, 60_000);

describe("the proposal renders to PDF", () => {
  it("accepts a caller-supplied adapter without consulting the named engines", async () => {
    let prepared: PreparedPdfInput | undefined;
    const adapter: PdfAdapter = {
      name: "customer-engine",
      directions: ["ltr"],
      async render(input) {
        prepared = input;
        return { bytes: new Uint8Array([1, 2, 3]), unknownBreaks: [], unknownRepeats: [] };
      },
    };

    const result = await renderPdf(<div>Adapter seam</div>, { adapter });

    expect(result.bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(prepared?.element).toBeDefined();
    expect(prepared?.fonts.length).toBeGreaterThan(0);
  });

  it("resolves application-owned font bytes once and carries their identity and CSS", async () => {
    let prepared: PreparedPdfInput | undefined;
    const adapter: PdfAdapter = {
      name: "font-inspector",
      directions: ["ltr"],
      async render(input) {
        prepared = input;
        return { bytes: new Uint8Array(), unknownBreaks: [], unknownRepeats: [] };
      },
    };
    const font = {
      family: "Application Sans",
      source: "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
      weight: "100 900",
    } as const;

    const result = await renderPdf(<div className="font-application">Typography</div>, {
      adapter,
      fonts: [font, font],
      applicationCss: '.font-application { font-family: "Application Sans"; }',
    });

    expect(prepared?.applicationCss).toContain("Application Sans");
    const applicationFaces = prepared?.fonts.filter((face) => face.family === "Application Sans");
    expect(applicationFaces).toHaveLength(2);
    expect(applicationFaces?.[0]?.identity).toMatch(/^[a-f0-9]{64}$/u);
    expect(applicationFaces?.[0]?.data).toBe(applicationFaces?.[1]?.data);
    expect(result.fontResources?.find((face) => face.family === "Application Sans")).toMatchObject({
      family: "Application Sans",
      weight: "100 900",
      style: "normal",
      identity: applicationFaces?.[0]?.identity,
    });
  });

  it("does not relabel a custom adapter's initialization failure as a missing peer", async () => {
    const initializationFailure = new Error("company engine could not initialize");
    const adapter: PdfAdapter = {
      name: "company-engine",
      directions: ["ltr"],
      async render() {
        throw initializationFailure;
      },
    };

    await expect(renderPdf(<div>Adapter seam</div>, { adapter })).rejects.toBe(initializationFailure);
  });

  it("rejects a preview plan when the render substitutes different font resources", async () => {
    const source = "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2";
    const resolved = await resolveFontResource({ family: "Preview", source });
    await expect(renderPdf(<div>Mismatch</div>, {
      adapter: { name: "inspect", directions: ["ltr"], async render() { return { bytes: new Uint8Array(), unknownBreaks: [], unknownRepeats: [] }; } },
      fonts: [{ family: "Changed", source }],
      plan: { breaks: [], repeats: [], fonts: { identity: "preview", css: "", resources: [{ family: "Preview", source, integrity: resolved.identity! }] } },
    })).rejects.toBeInstanceOf(FontResourceIdentityMismatchError);
  });

  it("makes the constrained adapter refuse application typography explicitly", async () => {
    await expect(renderPdf(<div>Unsupported</div>, { applicationCss: ".x { font-family: App }" }))
      .rejects.toBeInstanceOf(UnsupportedApplicationTypographyError);
  });

  it("uses the page geometry the preview fixes", () => {
    for (const page of [...overflow, ...short]) {
      expect(page.size.width).toBeCloseTo(PAPER_WIDTH_PX * PX_TO_PT, 0);
      expect(page.size.height).toBeCloseTo(PAPER_HEIGHT_PX * PX_TO_PT, 0);
    }
  });

  it("gives the short set one page and the overflow set four", () => {
    // Exact counts, not a floor: the reset stylesheet brings the engine's
    // layout within one percent of the browser's, so a regression in either
    // direction has to fail rather than pass a range.
    expect(short.length).toBe(1);
    expect(overflow.length).toBe(4);
  });

  it("carries selectable text, not a picture of the document", () => {
    const first = overflow[0]!.text;
    expect(first).toContain("Services Proposal");
    expect(first).toContain("Northgate Systems");
    expect(first).toContain("Harbor Freight Collective");
  });

  it("renders the values the artifact's serializers produce", () => {
    const all = overflow.map((page) => page.text).join("");
    expect(all).toContain("Tax (8.25%)");
    expect(all).toContain("$406,327.20");
    expect(all).toContain("1400 Rio Grande Street, Suite 220");
  });

  it("paints the logo on the masthead page and nowhere else", () => {
    expect(overflow[0]!.hasImage).toBe(true);
    expect(overflow.slice(1).every((page) => !page.hasImage)).toBe(true);
  });

  it("puts the signature blocks on the last page", () => {
    expect(overflow.at(-1)!.text).toContain("Signature (required)");
  });

  it("embeds every Inter subset the preview loads, not only the Latin ones", async () => {
    const cyrillic = "Договор оказания услуг";
    const greek = "Σύμβαση παροχής";
    const pages = await readPdf(
      (
        await renderPdf(
          <div className="flex flex-col">
            <span>{cyrillic}</span>
            <span>{greek}</span>
          </div>
        )
      ).bytes
    );
    // A missing subset renders as null glyphs, silently. The text has to come
    // back as the text that went in.
    expect(pages[0]!.text).toContain(cyrillic);
    expect(pages[0]!.text).toContain(greek);
    expect(pages[0]!.text.includes("\u0000")).toBe(false);
  }, 60_000);
});

describe("nothing degrades silently", () => {
  it("fails on a Tailwind class the engine cannot express, naming it", async () => {
    const error = await renderPdf(
      <div className="flex grid-cols-3 hover:bg-red-500 text-sm">
        <span>unsupported</span>
      </div>
    ).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(UnsupportedPdfContentError);
    const failure = error as UnsupportedPdfContentError;
    expect(failure.classes).toEqual(["grid-cols-3", "hover:bg-red-500"]);
    expect(failure.message).toContain("grid-cols-3");
    expect(failure.message).toContain("hover:bg-red-500");
  });

  it("fails when an image has no bytes, naming its source", async () => {
    const error = await renderPdf(<ProposalDocument data={shortProposalData} />).catch(
      (thrown: unknown) => thrown
    );

    expect(error).toBeInstanceOf(UnsupportedPdfContentError);
    expect((error as UnsupportedPdfContentError).images).toEqual([PROPOSAL_LOGO_SRC]);
    expect((error as Error).message).toContain(PROPOSAL_LOGO_SRC);
  });

  it("fails when an image's bytes are not an encoding the engine decodes", async () => {
    const error = await renderPdf(<ProposalDocument data={shortProposalData} />, {
      images: [{ src: PROPOSAL_LOGO_SRC, data: new Uint8Array([1, 2, 3, 4]) }],
    }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(UnsupportedPdfContentError);
    expect((error as UnsupportedPdfContentError).images).toEqual([PROPOSAL_LOGO_SRC]);
  });

  it("reports every offender in one error, not the first", async () => {
    const error = await renderPdf(
      <div className="flex">
        <span className="grid-cols-3">a</span>
        <span tw="aspect-video">b</span>
        <img src="missing-one.png" alt="" width={10} height={10} />
        <img src="missing-two.png" alt="" width={10} height={10} />
      </div>
    ).catch((thrown: unknown) => thrown);

    const failure = error as UnsupportedPdfContentError;
    // The second offender is written as `tw`, the engine's own property, which
    // must not be a way around the list.
    expect(failure.classes).toEqual(["grid-cols-3", "aspect-video"]);
    expect(failure.images).toEqual(["missing-one.png", "missing-two.png"]);
  });

  it("accepts an image that carries its own bytes", async () => {
    const pixel =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const pages = await readPdf(
      (
        await renderPdf(
          <div className="flex">
            <img src={pixel} alt="" width={8} height={8} />
          </div>
        )
      ).bytes
    );
    expect(pages[0]!.hasImage).toBe(true);
  }, 60_000);
});
