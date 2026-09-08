/**
 * The sample proposal's organization mark, as bytes.
 *
 * Sample material. No engine here fetches anything, so an image reaches the
 * render as bytes keyed by the `src` string in the tree; this reads the one PNG
 * that ships with the example and keys it the way `ProposalDocument` names it.
 * A real document supplies its own images the same way.
 *
 * Node only, which is why it is not in the browser entry beside the document.
 * This canonical source owns the asset beside the module.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { PdfImage } from "@paradoc/react-pdf";
import { PROPOSAL_LOGO_SRC } from "./logo";

let logo: Promise<PdfImage> | undefined;

/** The sample proposal's mark, read once per process. */
export function proposalLogoImage(): Promise<PdfImage> {
  logo ??= readFile(fileURLToPath(new URL("./proposal-logo.png", import.meta.url)))
    .then((data) => ({ src: PROPOSAL_LOGO_SRC, data: new Uint8Array(data) }))
    .catch((error: unknown) => {
      logo = undefined;
      throw error;
    });
  return logo;
}
