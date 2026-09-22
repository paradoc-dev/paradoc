/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/image` docs page's "From a source" variant: `src` names
 * where the picture is loaded from instead of carrying it as bytes.
 */

import { Image } from "../components/image";
import { sitePhotoDataUri } from "./sample-image";

export function ImageVariantSource() {
  return (
    <Image src={sitePhotoDataUri} width={96} height={96} alt="Harbor yard" keepId="site-photo-source" />
  );
}
