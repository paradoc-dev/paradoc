/**
 * The sample proposal's organization mark, as bytes.
 *
 * Sample material. No engine here fetches anything, so an image reaches the
 * render as bytes keyed by the `src` string in the tree; this reads the one PNG
 * that ships with the example and keys it the way `ProposalDocument` names it.
 * A real document supplies its own images the same way.
 *
 * Node only, which is why it is not in `./examples` beside the document. It is
 * resolved through the package's own export map rather than relative to this
 * module, because this module is one file in source and another in the built
 * bundle and the asset is neither. The export map names one path from both, and
 * it is the same path the preview loads the PNG from.
 */

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

import type { PdfImage } from "../pdf/resources";
import { PROPOSAL_LOGO_SRC } from "./logo";

const require = createRequire(import.meta.url);

let logo: Promise<PdfImage> | undefined;

/** The sample proposal's mark, read once per process. */
export function proposalLogoImage(): Promise<PdfImage> {
  logo ??= readFile(require.resolve("@paradoc/react/examples/proposal-logo.png"))
    .then((data) => ({ src: PROPOSAL_LOGO_SRC, data: new Uint8Array(data) }))
    .catch((error: unknown) => {
      logo = undefined;
      throw error;
    });
  return logo;
}
