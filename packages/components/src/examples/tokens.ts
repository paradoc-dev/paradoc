/**
 * A second token set for the sample proposal.
 *
 * Sample material, like the rest of `./examples`. Its purpose is evidence: the
 * default set has to render what the package rendered before there were tokens,
 * so the only way to show a token reaching both outputs is a set that changes
 * every one of them. This one changes all four — a serif, an accent, A4 with a
 * wider margin, and a different mark — and the parity suite measures the
 * document under it as well as under the default.
 *
 * The mark is bytes rather than a file, because `logo` accepts bytes and a
 * sample that only ever passed a string would leave that half unexercised. It
 * is a 40 x 40 PNG drawn here rather than shipped as a second asset: a solid
 * mark in the tenant's own colour is what a tenant's mark is standing in for.
 */

import type { DocumentTokensInput } from "@paradoc/react";

/** The tenant's mark, as base 64 PNG. */
const BRANDED_LOGO_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAIAAAADnC86AAAAPElEQVR42u3WsQkAIAwAwczgHm7o" +
  "0FYprLKDIBI4+P7ajzXHlwIMBoMfwSf3dWAwGAwGg8FglwkGg9vCBc996vpOSJfrAAAAAElFTkSu" +
  "QmCC";

/** Those bytes, decoded once. `atob` rather than `Buffer`: this entry is isomorphic. */
export const brandedProposalLogo: Uint8Array = Uint8Array.from(atob(BRANDED_LOGO_BASE64), (glyph) =>
  glyph.charCodeAt(0)
);

/** The accent the branded proposal is drawn in, matching the mark. */
export const BRANDED_ACCENT_COLOR = "#7c2d12";

/** Everything the branded proposal changes about the default document. */
export const brandedProposalTokens: DocumentTokensInput = {
  accentColor: BRANDED_ACCENT_COLOR,
  pageSize: "a4",
  marginPx: 56,
  logo: brandedProposalLogo,
};
