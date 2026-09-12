/**
 * Maps a component's registry name to the demo composition that renders it,
 * and to the live component behind each of its Variant subheadings.
 *
 * This is the one place that has to change when a new component or block
 * gets its docs page: add its demo/variants here (and to `DEMO_FILES` /
 * `VARIANT_FILES` in `scripts/sync-component-docs-content.ts`, whose keys
 * must line up with the variant keys below). `ComponentPreview` and
 * `ComponentVariant` are generic over `name` and never hardcode a component.
 */
import type { ComponentType } from "react";

import {
  FieldDemo,
  FieldVariantCustomLabel,
  FieldVariantDefaultLabel,
  FieldVariantNoLabel,
  SectionDemo,
  SectionVariantRow,
  SectionVariantTitled,
  SectionVariantUntitled,
  TableDemo,
  TableVariantCompact,
  TableVariantCustomHeaders,
  TableVariantLeftAligned,
} from "@paradoc/components/examples";

export const COMPONENT_DEMOS: Record<string, ComponentType> = {
  field: FieldDemo,
  section: SectionDemo,
  table: TableDemo,
};

/** One component per variant key, matching `VARIANT_FILES` in the sync script. */
export const COMPONENT_VARIANTS: Record<string, Record<string, ComponentType>> = {
  field: {
    "default-label": FieldVariantDefaultLabel,
    "no-label": FieldVariantNoLabel,
    "custom-label": FieldVariantCustomLabel,
  },
  section: {
    titled: SectionVariantTitled,
    untitled: SectionVariantUntitled,
    row: SectionVariantRow,
  },
  table: {
    compact: TableVariantCompact,
    "left-aligned": TableVariantLeftAligned,
    "custom-headers": TableVariantCustomHeaders,
  },
};
