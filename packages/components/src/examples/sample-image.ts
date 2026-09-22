/**
 * The picture the sample proposal attaches, and the two attachments it carries.
 *
 * Sample material. The picture is a small PNG carried as base 64 rather than a
 * file on disk, because the docs site renders these examples in a browser and
 * the tests render them in Node, and neither fetches anything. A raster rather
 * than an SVG: the default engine serializes an SVG into the page as vectors,
 * so only a raster proves an image was embedded and painted as one.
 */

import { imageDataUri } from "@paradoc/react";
import type { Attachment } from "@paradoc/types";

/** A 64×64 sketch of a yard: sky, ground, a shed, a container, and the sun. */
const SITE_PHOTO_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAnUlEQVR42u3XsQ3CMBRFUW+UGdJR" +
  "pc4KmYJRGIIJ0rFJOgqUAUKPQQ4C7C+OdAd4Ry5sp+W6hi4BAAAAfKHbPIQE3Hc/FgOQnV7CSCHW" +
  "vzAA/Gr9MwPAnwN2rc8anABAeICLzFuo0ddodxjfq5X/QF3AB35kAAAAANEB/XQsDwAAAAAAAAAA" +
  "AACgAuB0voQOAAAAAAAAAAAAAAAgbBvRstlWGozs+QAAAABJRU5ErkJggg==";

function bytesOf(base64: string): Uint8Array {
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

/** The site photograph's own bytes, as an image component takes them. */
export const sitePhotoBytes: Uint8Array = bytesOf(SITE_PHOTO_BASE64);

/**
 * The same picture as a `data:` URI.
 *
 * What a browser preview passes as the attachment's `src`: the PDF path is
 * handed bytes keyed by the attachment's file name, and a browser has no such
 * key, so the preview is given something it can load instead.
 */
export const sitePhotoDataUri: string = imageDataUri(sitePhotoBytes, "site photograph");

/** The attachment filling the sample's `sitePhoto` annex slot. */
export const sitePhotoAttachment: Attachment = {
  name: "harbor-yard.png",
  mimeType: "image/png",
};

/** The attachment filling the sample's `surveyReport` slot, which is not a picture. */
export const surveyReportAttachment: Attachment = {
  name: "harbor-survey.pdf",
  mimeType: "application/pdf",
};
