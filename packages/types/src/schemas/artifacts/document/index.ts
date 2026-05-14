/**
 * Document artifact type definition
 */

import type { ArtifactBase, Layer } from "../shared";

/**
 * Document artifact - static content with no inputs.
 * Documents are used for disclosures, pamphlets, or any static content
 * that can be rendered to different formats via layers.
 */
export interface Document extends ArtifactBase {
  /** Literal `"document"` discriminator. */
  kind: "document";
  /** Named layers for rendering this document into different formats. */
  layers?: Record<string, Layer>;
  /** Key of the default layer to use when none specified. */
  defaultLayer?: string;
}
