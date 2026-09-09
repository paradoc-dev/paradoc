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

export interface QRCodeProps {
  /** The URL encoded by the QR code. */
  url: string;
  /** Width and height in pixels. Defaults to 128. */
  size?: number;
  /** QR module color. Defaults to black. */
  color?: string;
  /** Background color behind the modules. Defaults to white. */
  backgroundColor?: string;
  /** Accessible name for the SVG. Defaults to `QR code for <url>`. */
  label?: string;
  className?: string;
}

/** An SVG QR code that encodes one URL. */
export function QRCode({
  url,
  size = 128,
  color = "#000000",
  backgroundColor = "#ffffff",
  label = `QR code for ${url}`,
  className,
}: QRCodeProps) {
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
