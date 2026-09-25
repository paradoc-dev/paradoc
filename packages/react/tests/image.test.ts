/**
 * What an image's bytes are, decided from the bytes themselves.
 *
 * The sniffing is isomorphic and both sides depend on it: the PDF path rejects
 * bytes no engine decodes before the render rather than after, and the tokens
 * turn logo bytes into the `data:` URI the preview's `<img>` loads. A format it
 * got wrong would be an image silently missing from one output, so every branch
 * is exercised here rather than only through a render.
 */

import { describe, expect, it } from "vitest";

import {
  imageDataUri,
  imageFormat,
  imageMediaType,
  imageSource,
  MissingImageSourceError,
  UndecodableImageError,
} from "../src/lib/image";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);

/** A RIFF container whose form type says WebP. */
function riff(form: string): Uint8Array {
  const bytes = new Uint8Array(16);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  bytes.set([...form].map((glyph) => glyph.charCodeAt(0)), 8);
  return bytes;
}

describe("SVG root sniffing", () => {
  const bytes = (text: string) => new TextEncoder().encode(text);
  it("skips prolog material but requires an SVG root", () => {
    expect(imageFormat(bytes('<?xml version="1.0"?><note/>'))).toBeUndefined();
    expect(imageFormat(bytes('<!-- made here --><svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe("svg");
    expect(imageFormat(bytes('<!DOCTYPE svg PUBLIC "x"><svg/>'))).toBe("svg");
    expect(imageFormat(bytes('<!DOCTYPE svg [<!ENTITY sample "ok">]><svg/>'))).toBe("svg");
  });
});

function text(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

describe("the encoding of some bytes", () => {
  it.each([
    ["png", PNG],
    ["jpeg", JPEG],
    ["gif", GIF],
    ["webp", riff("WEBP")],
  ])("recognises %s from its signature", (format, bytes) => {
    expect(imageFormat(bytes)).toBe(format);
  });

  it("recognises SVG, which arrives as text rather than a binary header", () => {
    expect(imageFormat(text('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe("svg");
    expect(imageFormat(text('  <?xml version="1.0"?><svg></svg>'))).toBe("svg");
  });

  it("refuses a RIFF container that is not WebP", () => {
    // The same header fronts WAV and AVI, which no engine here decodes.
    expect(imageFormat(riff("WAVE"))).toBeUndefined();
    expect(imageFormat(riff("AVI "))).toBeUndefined();
  });

  it("answers undefined for bytes that are not an image", () => {
    expect(imageFormat(text("this is a note, not a picture"))).toBeUndefined();
    expect(imageFormat(new Uint8Array())).toBeUndefined();
  });
});

describe("the media type a format is carried as", () => {
  it("spells SVG the way the standard does and the rest the obvious way", () => {
    expect(imageMediaType("svg")).toBe("image/svg+xml");
    expect(imageMediaType("png")).toBe("image/png");
    expect(imageMediaType("jpeg")).toBe("image/jpeg");
  });
});

describe("bytes as a source both outputs can read", () => {
  it("encodes them as a data URI carrying their own media type", () => {
    const uri = imageDataUri(PNG, "logo");
    expect(uri.startsWith("data:image/png;base64,")).toBe(true);
    const decoded = Uint8Array.from(atob(uri.slice(uri.indexOf(",") + 1)), (glyph) =>
      glyph.charCodeAt(0)
    );
    expect([...decoded]).toEqual([...PNG]);
  });

  it("survives a byte above 127, which a naive encoder loses", () => {
    const uri = imageDataUri(JPEG, "logo");
    const decoded = Uint8Array.from(atob(uri.slice(uri.indexOf(",") + 1)), (glyph) =>
      glyph.charCodeAt(0)
    );
    expect([...decoded]).toEqual([...JPEG]);
  });

  it("refuses bytes that are not an image, naming what they were meant to be", () => {
    expect(() => imageDataUri(text("nope"), "logo")).toThrow(UndecodableImageError);
    expect(() => imageDataUri(text("nope"), "logo")).toThrow(/logo bytes/);
  });
});

describe("the one source both outputs read", () => {
  it("embeds bytes and leaves a source string alone", () => {
    expect(imageSource({ bytes: PNG }, "logo")).toBe(imageDataUri(PNG, "logo"));
    expect(imageSource({ src: "paradoc:logo.png" }, "logo")).toBe("paradoc:logo.png");
  });

  it("prefers bytes over a source, because bytes need nothing supplied", () => {
    expect(imageSource({ bytes: PNG, src: "paradoc:logo.png" }, "logo")).toBe(
      imageDataUri(PNG, "logo")
    );
  });

  it("encodes one array once, because a tree is rendered more than once", () => {
    // Same array, same string identity: the encoding is cached against it.
    // Equal bytes in a different array are a different picture to the cache.
    const twin = new Uint8Array(PNG);
    expect(imageSource({ bytes: PNG }, "logo")).toBe(imageSource({ bytes: PNG }, "logo"));
    expect(imageSource({ bytes: twin }, "logo")).toBe(imageSource({ bytes: PNG }, "logo"));
  });

  it("fails by name with neither, and on bytes no renderer decodes", () => {
    expect(() => imageSource({}, "logo")).toThrow(MissingImageSourceError);
    expect(() => imageSource({ src: "" }, "logo")).toThrow(/logo/);
    expect(() => imageSource({ bytes: text("nope") }, "logo")).toThrow(UndecodableImageError);
  });
});
