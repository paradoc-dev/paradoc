/**
 * Checklist artifact type definition
 */

import type { ArtifactBase, Layer } from "../shared";
import type { ChecklistItem } from "./item";

/**
 * Checklist artifact containing ordered items to track.
 * Checklists are used for tracking progress through a series of tasks or requirements.
 */
export interface Checklist extends ArtifactBase {
  /** Literal `"checklist"` discriminator. */
  kind: "checklist";
  /** Ordered list of checklist items. */
  items: ChecklistItem[];
  /** Named layers for rendering this checklist into different formats. */
  layers?: Record<string, Layer>;
  /** Key of the default layer to use when none specified. */
  defaultLayer?: string;
}

export type {
  BooleanStatusSpec,
  EnumStatusOption,
  EnumStatusSpec,
  StatusSpec,
  ChecklistItem,
} from "./item";
