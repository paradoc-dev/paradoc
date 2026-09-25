/** @jsxRuntime classic */
import React from "react";
import { describe, expect, it } from "vitest";
import { checkElement } from "@paradoc/react-pdf/check";
import { renderPdf, UnsupportedPdfContentError } from "@paradoc/react-pdf";
import { Document } from "../src/components/document";
import { Field } from "../src/components/field";
import { proposalForm } from "../src/examples/proposal";
import { shortProposalData } from "../src/examples/proposal-data";

const TIFF_BYTES = new Uint8Array([0x49, 0x49, 0x2a, 0x00, 0x08, 0, 0, 0]);
const withPhoto = (name: string, mimeType: string) => ({ ...shortProposalData, annexes: { ...shortProposalData.annexes, sitePhoto: { name, mimeType } } });
const picture = (name: string, mimeType: string) => <Document artifact={proposalForm} data={withPhoto(name, mimeType)} id="picture"><Field path="annexes.sitePhoto" as="image" width={40} height={40} /></Document>;

describe("framework-react-seams-004", () => {
  it("reports TIFF during check and rejects its bytes during render", async () => {
    expect((await checkElement(picture("scan.tif", "image/tiff"))).unresolvedPaths).toContain("image:annexes.sitePhoto");
    await expect(renderPdf(picture("scan.tif", "image/tiff"), { images: [{ src: "scan.tif", data: TIFF_BYTES }] })).rejects.toThrow(UnsupportedPdfContentError);
  }, 60_000);
  it("accepts drawable MIME types case-insensitively", async () => {
    expect((await checkElement(picture("logo.png", "IMAGE/PNG"))).unresolvedPaths).toEqual([]);
  });
});
