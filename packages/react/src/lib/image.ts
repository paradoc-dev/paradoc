/**
 * What an image's bytes are, decided from the bytes themselves.
 *
 * The PDF path rejects bytes the engine cannot decode before the render rather
 * than after, so the error names the image that is wrong instead of arriving
 * from inside an engine with no source. The same question is asked in the
 * browser, where a logo supplied as bytes has to become a `data:` URI an
 * `<img>` can load, so this is isomorphic and carries no Node import.
 */

/** The encodings the engine decodes, by the bytes that identify them. */
const IMAGE_SIGNATURES: readonly { format: string; magic: readonly (number | null)[] }[] = [
  { format: "png", magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { format: "jpeg", magic: [0xff, 0xd8, 0xff] },
  { format: "gif", magic: [0x47, 0x49, 0x46, 0x38] },
  // A RIFF container is only WebP when its form type says so; the same header
  // fronts WAV and AVI, which the engine cannot decode.
  {
    format: "webp",
    magic: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50],
  },
];

/** The encoding of `data`, or `undefined` when the engine cannot decode it. */
export function imageFormat(data: Uint8Array): string | undefined {
  for (const { format, magic } of IMAGE_SIGNATURES) {
    if (magic.every((byte, index) => byte === null || data[index] === byte)) {
      return format;
    }
  }
  // SVG embeds as vectors and arrives as text rather than a binary header.
  const head = new TextDecoder().decode(data.subarray(0, 256)).trimStart();
  if (head.startsWith("<svg") || head.startsWith("<?xml")) return "svg";
  return undefined;
}

/** The MIME type a decodable format is carried as. */
export function imageMediaType(format: string): string {
  return format === "svg" ? "image/svg+xml" : `image/${format}`;
}

/** Thrown when bytes handed to the document are not an image any renderer decodes. */
export class UndecodableImageError extends Error {
  constructor(what: string) {
    super(
      `The ${what} bytes are not a PNG, JPEG, GIF, WebP or SVG. Neither the browser nor ` +
        "the PDF engine can decode them, and a document that silently dropped the image " +
        "would differ from the one that was asked for."
    );
    this.name = "UndecodableImageError";
  }
}

/**
 * Base 64 for bytes, in whichever runtime the document is rendered in.
 *
 * `btoa` rather than `Buffer`: the tokens are resolved on both sides, and a
 * browser bundle that reached for `Buffer` would pull a polyfill in behind it.
 */
function base64(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Encoded pictures, against the array they came from.
 *
 * Base 64 of a picture is not free, and the same bytes are encoded again on
 * every render of the tree that carries them — a document root resolves its
 * tokens each time, and pagination renders the tree once per page. The cache is
 * weak, so it holds nothing the caller has let go.
 */
const dataUris = new WeakMap<Uint8Array, string>();

/**
 * Bytes as a `data:` URI, which is the one image source both outputs read
 * without fetching anything.
 *
 * @throws {UndecodableImageError} when the bytes are not an image.
 */
export function imageDataUri(data: Uint8Array, what: string): string {
  const cached = dataUris.get(data);
  if (cached !== undefined) return cached;
  const format = imageFormat(data);
  if (format === undefined) throw new UndecodableImageError(what);
  const uri = `data:${imageMediaType(format)};base64,${base64(data)}`;
  dataUris.set(data, uri);
  return uri;
}

/** Thrown when an image is placed with neither bytes nor a source to load. */
export class MissingImageSourceError extends Error {
  constructor(what: string) {
    super(
      `The ${what} has neither bytes nor a source. An image reaches both outputs as one ` +
        "source string: bytes are embedded as a `data:` URI, and a source string is the key " +
        "the PDF path supplies bytes under or a URL the browser loads."
    );
    this.name = "MissingImageSourceError";
  }
}

/** Thrown when an image is placed without the size both outputs lay it out at. */
export class MissingImageSizeError extends Error {
  constructor(what: string) {
    super(
      `The ${what} has no declared width and height. Neither the preview nor the PDF engine ` +
        "measures an image to find its size, so an image with no declared size would take a " +
        "different amount of the page in each output."
    );
    this.name = "MissingImageSizeError";
  }
}

/**
 * The one source string both outputs read for an image, from bytes or from a
 * source already named.
 *
 * Bytes win: a caller that has the picture itself needs nothing fetched or
 * supplied, in either output. A source string is passed through untouched,
 * because it is a key the PDF path supplies bytes under, not a URL this layer
 * may rewrite.
 *
 * @throws {UndecodableImageError} when the bytes are not an image.
 * @throws {MissingImageSourceError} when neither is given.
 */
export function imageSource(
  source: { src?: string; bytes?: Uint8Array },
  what: string
): string {
  if (source.bytes !== undefined) return imageDataUri(source.bytes, what);
  if (source.src !== undefined && source.src !== "") return source.src;
  throw new MissingImageSourceError(what);
}
