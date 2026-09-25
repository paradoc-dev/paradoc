/**
 * Bundle content item types
 */

import type { CondExpr } from "../shared/expressions";
import type { Document } from "../document";
import type { Form } from "../form";
import type { Checklist } from "../checklist";
import type { ArtifactBase } from "../shared";
import type { DefsSection } from "../shared/expressions";

/** A recursive container for content artifacts. */
export interface Bundle extends ArtifactBase {
  /** Literal `"bundle"` discriminator. */
  kind: "bundle";
  /** Named definitions that can be referenced in include conditions. */
  defs?: DefsSection;
  /** Ordered list of bundle contents with keys. */
  contents: BundleContentItem[];
}

/**
 * Inline bundle content item with embedded artifact.
 */
export interface InlineBundleItem {
  /** Discriminator for inline bundle item. */
  type: "inline";
  /** Unique key for this item within the bundle. */
  key: string;
  /** The embedded artifact (document, form, checklist, or nested bundle). */
  artifact: Document | Form | Checklist | Bundle;
  /** Conditional expression for including this item. */
  include?: CondExpr;
}

/**
 * Path-based bundle content item referencing a local file.
 */
export interface PathBundleItem {
  /** Discriminator for path-based bundle item. */
  type: "path";
  /** Unique key for this item within the bundle. */
  key: string;
  /** File path to the artifact definition. */
  path: string;
  /** Conditional expression for including this item. */
  include?: CondExpr;
}

/**
 * Registry-based bundle content item referencing a published artifact.
 */
export interface RegistryBundleItem {
  /** Discriminator for registry-based bundle item. */
  type: "registry";
  /** Unique key for this item within the bundle. */
  key: string;
  /** Registry slug identifying the artifact. */
  slug: string;
  /** Conditional expression for including this item. */
  include?: CondExpr;
}

/**
 * Bundle content item - inline artifact, path reference, or registry reference.
 */
export type BundleContentItem =
  | InlineBundleItem
  | PathBundleItem
  | RegistryBundleItem;
