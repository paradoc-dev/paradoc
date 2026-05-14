/**
 * Bundle content item types
 */

import type { CondExpr } from "../shared/expressions";
import type { Document } from "../document";
import type { Form } from "../form";
import type { Checklist } from "../checklist";
import type { Bundle } from "./index";

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
