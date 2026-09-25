import { afterAll, describe, expect, it } from "vitest";
import { renderPdf } from "../src";
import { closeChromium } from "../src/adapters/chromium";
import { readPdf } from "./pdf-reader";

const marker = "⠁⠂";
const doc = <div><p>Hello</p><p>{marker}</p></div>;

async function chromiumText(options: Parameters<typeof renderPdf>[1] = {}) {
  const { bytes } = await renderPdf(doc, { ...options, adapter: "chromium", signingMarkers: true });
  return (await readPdf(bytes)).map((page) => page.text).join("");
}

describe("paradoc-react-pdf-001", () => {
  afterAll(async () => closeChromium());
  it("renders signing marker glyphs in Chromium without application fonts", async () => {
    expect(await chromiumText()).toContain(marker);
  }, 120_000);

  it("keeps marker coverage in an application font's stack", async () => {
    expect(await chromiumText({
      fonts: [{
        family: "Application Sans",
        source: "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
        weight: "100 900",
      }],
      applicationCss: 'body { font-family: "Application Sans"; }',
    })).toContain(marker);
  }, 120_000);
});
