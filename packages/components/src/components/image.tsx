/**
 * A picture placed in a document at a declared size.
 *
 * An image reaches both outputs as one source string. Bytes are embedded as a
 * `data:` URI after the encoding is sniffed, so the picture travels inside the
 * tree and neither output fetches anything; a `src` string is the key the PDF
 * path supplies bytes under and the URL a browser preview loads, which is why
 * the two agree on the key rather than on a URL.
 *
 * The size is declared rather than measured. Neither the preview nor the PDF
 * engine reads an image's intrinsic size during layout, so an image with no
 * declared width and height would take a different amount of the page in each
 * output, and the page plan the two share would stop agreeing.
 *
 * It is declared twice, as attributes and inline. The engine reads the
 * attributes; a browser does not, because Tailwind's preflight sets
 * `img { max-width: 100%; height: auto }` and an author rule beats a
 * presentational hint. Without the inline size the preview would draw the
 * picture at its own aspect ratio while the PDF drew it at the declared one,
 * which is the disagreement the declared size exists to prevent.
 */
/** @jsxRuntime classic */
import React from "react";
import { imageSource } from "@paradoc/react";
import { KeepTogether } from "./keep-together";

export interface ImageProps {
  /**
   * Where the render loads the picture from: the key the PDF path supplies its
   * bytes under, or a URL a browser preview can load. Ignored when `bytes` is
   * given.
   */
  src?: string;
  /** The picture's own bytes, embedded after the encoding is sniffed. Wins over `src`. */
  bytes?: Uint8Array;
  /** Rendered width in CSS pixels. */
  width: number;
  /** Rendered height in CSS pixels. */
  height: number;
  /**
   * Accessible description. Leave it empty for a decorative mark the text
   * beside it already names.
   * @default ""
   */
  alt?: string;
  /** Stable id the page plan tracks this image by; must be unique within the document. */
  keepId: string;
  /** Application-owned classes on the image. */
  className?: string;
}

/**
 * One picture, kept together as its own pagination unit.
 *
 * @throws {UndecodableImageError} when `bytes` are not a PNG, JPEG, GIF, WebP or SVG.
 * @throws {MissingImageSourceError} when neither `bytes` nor `src` is given.
 */
export function Image({ src, bytes, width, height, alt = "", keepId, className }: ImageProps) {
  return (
    <KeepTogether
      as="img"
      keepId={keepId}
      src={imageSource({ src, bytes }, `image "${keepId}"`)}
      alt={alt}
      width={width}
      height={height}
      style={{ width, height }}
      className={className}
    />
  );
}
