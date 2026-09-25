import { expect, it } from "vitest";
import { imageFormat } from "../src/lib/image";
const bytes = (text: string) => new TextEncoder().encode(text);
it("accepts SVG only when the root after prolog material is svg", () => {
  expect(imageFormat(bytes('<?xml version="1.0"?><note>hi</note>'))).toBeUndefined();
  expect(imageFormat(bytes('<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg/>'))).toBe("svg");
  expect(imageFormat(bytes('<!-- Generator --><svg/>'))).toBe("svg");
  expect(imageFormat(bytes('<?xml version="1.0"?><svg/>'))).toBe("svg");
});
