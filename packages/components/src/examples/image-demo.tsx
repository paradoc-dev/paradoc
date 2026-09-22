/** @jsxRuntime classic */
import React from "react";

/**
 * Demo composition for the `/components/image` docs page.
 *
 * The bytes form: the picture travels inside the tree, so neither the preview
 * nor the PDF fetches or is handed anything. This is what the docs page's live
 * Preview renders, and its raw source is what the Composition section shows.
 */

import { Image } from "../components/image";
import { sitePhotoBytes } from "./sample-image";

export function ImageDemo() {
  return (
    <Image bytes={sitePhotoBytes} width={160} height={160} alt="Harbor yard" keepId="site-photo" />
  );
}
