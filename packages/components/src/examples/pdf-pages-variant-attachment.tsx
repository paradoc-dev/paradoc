/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/pdf-pages` docs page's "Attachment fallback" variant:
 * content pdf.js cannot open renders as the named `Attachment` card instead
 * of pages.
 */

import { PdfPages } from "../components/pdf-pages";

/** Deliberately not a PDF, so painting fails and the attachment fallback shows. */
const UNPAINTABLE_BYTES = new TextEncoder().encode("Not a real PDF.");

export function PdfPagesVariantAttachment() {
  return <PdfPages bytes={UNPAINTABLE_BYTES} filename="unreadable-scan.pdf" />;
}
