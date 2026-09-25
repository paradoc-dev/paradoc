/**
 * `@paradoc/react` — compose a document from React components bound to a
 * Paradoc form artifact.
 *
 * One tree is the source of truth for the paginated preview and for the PDF.
 * This entry is what runs in a browser: providers, focused bindings,
 * measurement, and page planning. Visible component source is installed into
 * the consumer's project. `@paradoc/react-pdf` is the Node-only half.
 *
 * The artifact packages — `@paradoc/core`, `@paradoc/types`, `@paradoc/render`
 * and `@paradoc/format` — are consumed unchanged.
 */

export {
  captureApplicationFonts,
  type ApplicationFontResource,
  type ApplicationFontSnapshot,
} from "./lib/application-fonts";
// `ArtifactProvider` reads this on every render, checking or not, so it is substrate
// an installed `document.tsx` must reach through this package rather than a
// copy of its own.
// `@paradoc/react-pdf/check` is the only caller that ever supplies one.
export {
  CheckModeProvider,
  useUnresolvedPathCollector,
  type CheckModeProviderProps,
  type UnresolvedPathCollector,
} from "./components/check-context";
// Substrate for the same reason: `Document` reads partial mode on every render,
// partial or not, and an installed `document.tsx` must read the one its caller
// set rather than a copy that is always false.
export {
  PartialValuesProvider,
  usePartialValues,
  type PartialValuesProviderProps,
} from "./components/partial-context";
// The provider is the seal's, and the seal is Node: it is exported from
// `@paradoc/react-pdf`. The hook is not — `useSignature` calls it on every
// render, sealing or not — so it belongs to the browser entry alongside the
// shared rendering vocabulary.
export {
  AmbiguousSigningMarkError,
  SigningMarkerProvider,
  useSigningMarks,
  type SigningMarkerProviderProps,
  type SigningMarks,
  type SigningMarkType,
} from "./components/signing-context";
export {
  PageContextProvider,
  useKeepVisible,
  usePage,
  usePageNumber,
  usePagePlan,
  useSectionVisible,
  type PageContextValue,
  type PageNumbering,
} from "./components/page-context";
// What a document carries on every page. The type and the placement rule are
// shared by the preview's bands and the PDF path's, so neither owns them.
export {
  assertFurnitureBandFits,
  assertFurnitureStampFits,
  assertFurnitureSupported,
  declaredFurnitureSlots,
  furnitureBandBudgetPx,
  hasPageFurniture,
  FURNITURE_BAND_ATTRIBUTES,
  FURNITURE_EDGE_INSET_PX,
  FURNITURE_SLOTS,
  PAGE_COUNTER_ATTRIBUTE,
  RENDER_ATTRIBUTES,
  LTR_ISOLATE_CLASS,
  LTR_ISOLATE_STYLESHEET,
  PageFurnitureOverflowError,
  PageStampTooWideError,
  UnsupportedFurnitureContentError,
  UnsupportedFurnitureError,
  type FurnitureBandSlot,
  type FurnitureFit,
  type FurnitureSlot,
  type PageCounter,
  type PageFurniture,
  type StampMeasure,
} from "./lib/furniture";
export {
  DRAWABLE_IMAGE_FORMATS,
  DRAWABLE_IMAGE_MEDIA_TYPES,
  type DrawableImageFormat,
} from "./lib/image";
export {
  useFitToWidth,
  useFurnitureFit,
  PAGE_CONTENT_HEIGHT_PX,
  PAGE_CONTENT_WIDTH_PX,
  PAGE_GAP_PX,
  PAPER_HEIGHT_PX,
  PAPER_MARGIN_PX,
  PAPER_WIDTH_PX,
  type Fit,
  type FurnitureFitBinding,
} from "./headless/paper";
export {
  DocumentTokensProvider,
  markDocumentRoot,
  NestedPaperTokenError,
  RootTokenMismatchError,
  TokenOverrideProvider,
  useDocumentRootTokens,
  useDocumentTokens,
  useDocumentTokensAround,
  useTokenOverride,
  type ResolvedRoot,
  type TokenOverrideProviderProps,
} from "./components/tokens-context";
// The paper actually being drawn with. `Paper` and `Pages` supply it; a
// composition that draws its own sheet supplies it the same way. The geometry
// hook and the default reach the entry through `./components/paper`, which
// re-exports them, so only what is not already there is named here.
export {
  DEFAULT_PAGE_GEOMETRY,
  drawnPaper,
  DrawnPaperProvider,
  useDrawnPaper,
  usePaperGeometry,
  type DrawnPaper,
} from "./components/paper-geometry";
export {
  documentTokensOf,
  MultipleDocumentRootsError,
} from "./lib/document-tokens";
export {
  DATE_RULE,
} from "./headless/signing";
export { INITIALS_RULE, SIGNATURE_RULE } from "@paradoc/core";

export {
  annexSlot,
  CompositeFieldPathError,
  itemField,
  InvalidFieldPathError,
  pathSegments,
  readAnnex,
  readValue,
  resolveAnnex,
  resolveField,
  UnknownAnnexError,
  UnknownFieldPathError,
} from "./lib/fields";
export {
  ArtifactProvider,
  InvalidListValueError,
  MissingArtifactProviderError,
  UnknownDefinitionError,
  UnknownPartyRoleError,
  useAnnex,
  useAnnexPicture,
  useArtifact,
  useField,
  useFormatter,
  useList,
  useParty,
  useTotals,
  type AnnexBinding,
  type AnnexPictureBinding,
  type ArtifactProviderProps,
  type FieldBinding,
  type ListBinding,
  type TotalBinding,
  type DocumentData,
} from "./headless/artifact";
export {
  PartyIndexOutOfRangeError,
  usePartyContact,
  type PartyContactBinding,
  type PartyContactPaths,
} from "./headless/party";
export {
  BLANK,
  createValueFormatter,
  formatByType,
  ArtifactFieldFormatError,
  type DocumentFormatter,
  type FormatOptions,
  type ValueFormatter,
} from "./lib/format";
export {
  isTextDirection,
  scriptOf,
  DEFAULT_DOCUMENT_LANG,
  DEFAULT_TEXT_DIRECTION,
  type TextDirection,
} from "./lib/script";
export {
  imageDataUri,
  imageFormat,
  imageMediaType,
  imageSource,
  MissingImageSizeError,
  MissingImageSourceError,
  UndecodableImageError,
} from "./lib/image";
export {
  localeAttributes,
  isCssColor,
  pageGeometry,
  resolveDocumentTokens,
  disagreeingRootToken,
  sameDocumentTokens,
  DEFAULT_DOCUMENT_TOKENS,
  DEFAULT_PAGE_MARGIN_PX,
  DOCUMENT_TOKEN_KEYS,
  InvalidDocumentTokenError,
  PAGE_SIZES,
  ROOT_ONLY_TOKEN_KEYS,
  type DocumentTokens,
  type DocumentTokensInput,
  type PageDimensions,
  type PageGeometry,
  type PageSize,
} from "./lib/tokens";
export {
  DEFAULT_TYPOGRAPHY,
  TYPOGRAPHY_LEVELS,
  TYPOGRAPHY_CLASS_SCALE,
  TYPOGRAPHY_SAFELIST_PATTERNS,
  flowGapClasses,
  isTypographyLevel,
  scaleTextClasses,
  type Typography,
  type TypographyInput,
  type TypographyLevel,
} from "./lib/typography";
export { measureFurnitureBands, measureKeeps, type MeasuredFurnitureBand } from "./lib/measure";
export {
  MissingPdfPainterError,
  paintPdfPages,
  UnpaintablePdfError,
  type PaintedPdfPage,
  type PaintPdfOptions,
} from "./lib/pdf-painter";
export {
  planPages,
  InvalidPagePlanInputError,
  type MeasuredKeep,
  type OversizeKeep,
  type PagePlan,
} from "./lib/plan";
export {
  useDocumentSettings,
  type DocumentSettingsBinding,
} from "./headless/settings";
export {
  samePagePlan,
  useFontReadiness,
  usePagination,
  type FontReadiness,
  type PaginationBinding,
  type PaginationOptions,
} from "./headless/pagination";
export {
  useSignature,
  type SignatureBinding,
} from "./headless/signing";
export {
  resolvePartPlacement,
  usePdfPages,
  type PartPlacementBinding,
  type PartPlacementInput,
  type PartPlacementState,
  type PdfPagesBinding,
  type PdfPagesOptions,
  type PdfPaintReport,
} from "./headless/packet";
export { FormatterProvider, useArtifactFormatting, type ArtifactFormatting } from "./components/formatter-context";
export { isOutside } from "./lib/paths";
