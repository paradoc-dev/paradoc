/**
 * A portable QR code for linking a printed or previewed document to a URL.
 *
 * The SVG stays sharp at every output scale and works in both browser previews
 * and PDF rendering. Place it like any other element and use `className` on the
 * SVG when its surrounding layout needs alignment or spacing.
 */
/** @jsxRuntime classic */
import React from "react";
import { QRCodeSVG } from "qrcode.react";

/** Thrown when a {@link QRCode} is asked to encode an empty URL. */
export class EmptyQRCodeUrlError extends Error {
  constructor() {
    super(
      "QRCode needs a non-empty url to encode. A code with nothing to encode would print a " +
        "pattern that scans to nothing, which is worse than failing before the page is drawn."
    );
    this.name = "EmptyQRCodeUrlError";
  }
}

export interface QRCodeProps {
  /** The URL encoded by the QR code. */
  url: string;
  /**
   * Width and height in pixels.
   * @default 128
   */
  size?: number;
  /**
   * QR module color.
   * @default "#000000"
   */
  color?: string;
  /**
   * Background color behind the modules.
   * @default "#ffffff"
   */
  backgroundColor?: string;
  /**
   * Accessible name for the SVG.
   * @default "QR code for <url>"
   */
  label?: string;
  /** Application-owned classes on the SVG. */
  className?: string;
}

/**
 * An SVG QR code that encodes one URL.
 *
 * @throws {EmptyQRCodeUrlError} when `url` is empty.
 */
export function QRCode({
  url,
  size = 128,
  color = "#000000",
  backgroundColor = "#ffffff",
  label = `QR code for ${url}`,
  className,
}: QRCodeProps) {
  if (url.length === 0) throw new EmptyQRCodeUrlError();
  return (
    <QRCodeSVG
      value={url}
      size={size}
      fgColor={color}
      bgColor={backgroundColor}
      title={label}
      role="img"
      aria-label={label}
      className={className}
    />
  );
}
