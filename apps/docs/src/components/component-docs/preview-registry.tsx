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
  BundleDemo,
  BundleVariantBrandedTokens,
  BundleVariantRow,
  BundleVariantSingleDocument,
  DocumentDemo,
  DocumentVariantBrandedTokens,
  DocumentVariantCustomFormat,
  DocumentVariantCustomLayout,
  FieldDemo,
  FieldVariantCustomLabel,
  FieldVariantDefaultLabel,
  FieldVariantNoLabel,
  KeepTogetherDemo,
  KeepTogetherVariantCustomElement,
  KeepTogetherVariantDefaultElement,
  KeepTogetherVariantPassthroughAttributes,
  PagesDemo,
  PagesVariantCustomFrame,
  PagesVariantMultiPage,
  PagesVariantPageCount,
  PaperDemo,
  PaperVariantCustomFrame,
  PaperVariantMinimalContent,
  PaperVariantOverflowingContent,
  PartDemo,
  PartVariantPending,
  PartVariantPlaced,
  PartVariantUnplaced,
  PdfPagesDemo,
  PdfPagesVariantAttachment,
  PdfPagesVariantStandalone,
  PdfPagesVariantStyled,
  QRCodeDemo,
  QRCodeVariantCustomColors,
  QRCodeVariantCustomLabel,
  QRCodeVariantLargerSize,
  SectionDemo,
  SectionVariantRow,
  SectionVariantTitled,
  SectionVariantUntitled,
  SignatureDemo,
  SignatureVariantCustomId,
  SignatureVariantInitials,
  SignatureVariantSignature,
  TableDemo,
  TableVariantCompact,
  TableVariantCustomHeaders,
  TableVariantLeftAligned,
  TotalsDemo,
  TotalsVariantCustomLabel,
  TotalsVariantSingleRow,
  TotalsVariantWithTaxRate,
} from "@paradoc/components/examples";

export const COMPONENT_DEMOS: Record<string, ComponentType> = {
  bundle: BundleDemo,
  document: DocumentDemo,
  field: FieldDemo,
  "keep-together": KeepTogetherDemo,
  pages: PagesDemo,
  paper: PaperDemo,
  section: SectionDemo,
  table: TableDemo,
  part: PartDemo,
  "pdf-pages": PdfPagesDemo,
  "qr-code": QRCodeDemo,
  signature: SignatureDemo,
  totals: TotalsDemo,
};

/** One component per variant key, matching `VARIANT_FILES` in the sync script. */
export const COMPONENT_VARIANTS: Record<string, Record<string, ComponentType>> = {
  bundle: {
    "single-document": BundleVariantSingleDocument,
    row: BundleVariantRow,
    "branded-tokens": BundleVariantBrandedTokens,
  },
  document: {
    "custom-layout": DocumentVariantCustomLayout,
    "custom-format": DocumentVariantCustomFormat,
    "branded-tokens": DocumentVariantBrandedTokens,
  },
  field: {
    "default-label": FieldVariantDefaultLabel,
    "no-label": FieldVariantNoLabel,
    "custom-label": FieldVariantCustomLabel,
  },
  "keep-together": {
    "default-element": KeepTogetherVariantDefaultElement,
    "custom-element": KeepTogetherVariantCustomElement,
    "passthrough-attributes": KeepTogetherVariantPassthroughAttributes,
  },
  pages: {
    "multi-page": PagesVariantMultiPage,
    "custom-frame": PagesVariantCustomFrame,
    "page-count": PagesVariantPageCount,
  },
  paper: {
    "minimal-content": PaperVariantMinimalContent,
    "custom-frame": PaperVariantCustomFrame,
    "overflowing-content": PaperVariantOverflowingContent,
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
  part: {
    unplaced: PartVariantUnplaced,
    placed: PartVariantPlaced,
    pending: PartVariantPending,
  },
  "pdf-pages": {
    standalone: PdfPagesVariantStandalone,
    attachment: PdfPagesVariantAttachment,
    styled: PdfPagesVariantStyled,
  },
  "qr-code": {
    "custom-colors": QRCodeVariantCustomColors,
    "larger-size": QRCodeVariantLargerSize,
    "custom-label": QRCodeVariantCustomLabel,
  },
  signature: {
    signature: SignatureVariantSignature,
    initials: SignatureVariantInitials,
    "custom-id": SignatureVariantCustomId,
  },
  totals: {
    "single-row": TotalsVariantSingleRow,
    "with-tax-rate": TotalsVariantWithTaxRate,
    "custom-label": TotalsVariantCustomLabel,
  },
};
