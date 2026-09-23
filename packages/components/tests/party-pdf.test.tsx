import { renderPdf } from "@paradoc/react-pdf";
import { describe, expect, it } from "vitest";

import { Document, Party } from "../src";
import { readPdf } from "./pdf-reader";
import { buyerPaths, partyFixtureData as data, partyFixtureForm as artifact, witnessPaths } from "./party-fixture";

describe("Party PDF path", () => {
  it("prints a block party's name and its bound organization, address, and contact on the rendered page", async () => {
    const element = (
      <Document artifact={artifact} data={data}>
        <Party role="buyer" {...buyerPaths} />
      </Document>
    );
    const { bytes } = await renderPdf(element);
    const pages = await readPdf(bytes);
    expect(pages).toHaveLength(1);
    const text = pages[0]?.text ?? "";
    expect(text).toContain("Dana Whitfield");
    expect(text).toContain("Northgate Systems");
    expect(text).toContain("1400 Rio Grande Street");
    expect(text).toContain("+15125550123");
    expect(text).toContain("dana@northgate.example");
  });

  it("prints an inline party's name and its bound organization, address, and contact on the rendered page", async () => {
    const element = (
      <Document artifact={artifact} data={data}>
        <Party role="witness" index={1} variant="inline" label={false} {...witnessPaths(1)} />
      </Document>
    );
    const { bytes } = await renderPdf(element);
    const pages = await readPdf(bytes);
    const text = pages[0]?.text ?? "";
    expect(text).toContain("Second Witness");
    expect(text).toContain("Harbor Freight Collective");
    expect(text).toContain("88 Wharf Road");
    expect(text).toContain("+15105550199");
  });
});
