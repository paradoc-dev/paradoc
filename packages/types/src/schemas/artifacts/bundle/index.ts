/**
 * Bundle artifact type definition
 */

import type { DefsSection } from "../shared/expressions";
import type { ArtifactBase } from "../shared";
import type { BundleContentItem } from "./item";

/**
 * Bundle artifact - a recursive container for content artifacts.
 * Bundles group together documents, forms, checklists, and other bundles
 * into a single distributable unit.
 */
export interface Bundle extends ArtifactBase {
  /** Literal `"bundle"` discriminator. */
  kind: "bundle";
  /** Named definitions that can be referenced in include conditions. */
  defs?: DefsSection;
  /** Ordered list of bundle contents with keys. */
  contents: BundleContentItem[];
}

export type {
  BundleContentItem,
  InlineBundleItem,
  PathBundleItem,
  RegistryBundleItem,
} from "./item";
