/**
 * `@paradoc/react` — compose a document from React components bound to a
 * Paradoc form artifact.
 *
 * One tree is the source of truth for the paginated preview and for the PDF.
 * This entry is what runs in a browser: the components, the document context,
 * the page plan and the preview. `@paradoc/react-pdf` is the Node-only half.
 *
 * The artifact packages — `@paradoc/core`, `@paradoc/types`, `@paradoc/render`
 * and `@paradoc/format` — are consumed unchanged.
 */

export { KeepTogether, type KeepTogetherProps } from "./components/keep-together";
export { Bundle, type BundleProps } from "./components/bundle";
export { Document, type DocumentProps } from "./components/document";
export {
  createDocumentContext,
  DocumentContextProvider,
  useDocument,
  type DocumentContextValue,
  type DocumentData,
} from "./components/document-context";
// `Document` reads this on every render, checking or not, so it is substrate
// an installed `document.tsx` must reach through this package rather than a
// copy of its own — the same reason `useSigningMarks` is exported here.
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
// `@paradoc/react-pdf`. The hook is not — `Document` calls it on every render,
// sealing or not — so it belongs to the browser entry alongside the vocabulary
// a document context is described in.
export {
  AmbiguousSigningMarkError,
  SigningMarkerProvider,
  useSigningMarks,
  type SigningMarkerProviderProps,
  type SigningMarks,
  type SigningMarkType,
} from "./components/signing-context";
export { Field, type FieldProps } from "./components/field";
export {
  PageContextProvider,
  useKeepVisible,
  usePage,
  usePagePlan,
  useSectionVisible,
  type PageContextValue,
} from "./components/page-context";
export { Part, type PartKind, type PartPlacementState, type PartProps } from "./components/part";
export {
  Attachment,
  PdfPages,
  type AttachmentProps,
  type PdfPagesProps,
  type PdfPaintReport,
} from "./components/pdf-pages";
export { Page, Pages, type PageProps, type PagesProps } from "./components/pages";
export {
  Paper,
  Sheet,
  useFitToWidth,
  usePaperGeometry,
  DEFAULT_PAGE_GEOMETRY,
  PAGE_CONTENT_HEIGHT_PX,
  PAGE_CONTENT_WIDTH_PX,
  PAGE_GAP_PX,
  PAPER_HEIGHT_PX,
  PAPER_MARGIN_PX,
  PAPER_WIDTH_PX,
  type Fit,
  type PaperProps,
  type SheetProps,
} from "./components/paper";
export {
  DocumentTokensProvider,
  markDocumentRoot,
  NestedPaperTokenError,
  RootTokenMismatchError,
  TokenOverrideProvider,
  useDocumentRootTokens,
  useDocumentTokens,
  useTokenOverride,
  type ResolvedRoot,
  type TokenOverrideProviderProps,
} from "./components/tokens-context";
// The paper actually being drawn with. `Paper` and `Pages` supply it; a
// composition that draws its own sheet supplies it the same way. The geometry
// hook and the default reach the entry through `./components/paper`, which
// re-exports them, so only what is not already there is named here.
export {
  drawnPaper,
  DrawnPaperProvider,
  useDrawnPaper,
  type DrawnPaper,
} from "./components/paper-geometry";
export {
  documentTokensOf,
  MultipleDocumentRootsError,
} from "./lib/document-tokens";
export { Section, type SectionProps } from "./components/section";
export {
  DATE_RULE,
  INITIALS_RULE,
  Signature,
  SIGNATURE_RULE,
  type SignatureProps,
} from "./components/signature";
export { Table, type TableColumn, type TableProps } from "./components/table";
export { Totals, type TotalRow, type TotalsProps } from "./components/totals";

export {
  itemField,
  InvalidFieldPathError,
  pathSegments,
  readValue,
  resolveField,
  UnknownFieldPathError,
} from "./lib/fields";
export {
  ArtifactProvider,
  InvalidListValueError,
  MissingArtifactProviderError,
  UnknownDefinitionError,
  UnknownPartyRoleError,
  useArtifact,
  useField,
  useFormatter,
  useList,
  useParty,
  useTotals,
  type ArtifactProviderProps,
  type FieldBinding,
  type ListBinding,
  type TotalBinding,
} from "./headless/artifact";
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
  documentFontFamily,
  loadDocumentFaces,
  scriptProbeText,
  ARABIC_FONT_NAME,
  DOCUMENT_SCRIPTS,
  DOCUMENT_FONT_FAMILIES,
  DOCUMENT_FONT_FAMILY,
  DOCUMENT_FONT_NAME,
  DOCUMENT_FONT_PACKAGE,
  DOCUMENT_FONT_WEIGHTS,
  SERIF_FONT_NAME,
  UnregisteredFontFamilyError,
  type FontFamilyRegistration,
} from "./lib/font";
export {
  assertScriptCovered,
  assertTextScriptsCovered,
  collectStrings,
  isTextDirection,
  scriptOf,
  scriptsIn,
  DEFAULT_DOCUMENT_LANG,
  DEFAULT_TEXT_DIRECTION,
  UnsupportedScriptError,
  type TextDirection,
} from "./lib/script";
export {
  imageDataUri,
  imageFormat,
  imageMediaType,
  UndecodableImageError,
} from "./lib/image";
export {
  fontFamilyStyle,
  localeAttributes,
  isCssColor,
  pageGeometry,
  resolveDocumentTokens,
  disagreeingRootToken,
  sameDocumentTokens,
  tokenFontFamily,
  DEFAULT_DOCUMENT_TOKENS,
  DEFAULT_PAGE_MARGIN_PX,
  DOCUMENT_TOKEN_KEYS,
  FONT_FAMILY_PROPERTY,
  InvalidDocumentTokenError,
  PAGE_SIZES,
  ROOT_ONLY_TOKEN_KEYS,
  type DocumentTokens,
  type DocumentTokensInput,
  type PageDimensions,
  type PageGeometry,
  type PageSize,
} from "./lib/tokens";
export { measureKeeps } from "./lib/measure";
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
  type PdfPagesBinding,
  type PdfPagesOptions,
} from "./headless/packet";
export { computeLineAmounts, type LineItem, type LineItemInput } from "./lib/totals";

export { FormatterProvider, useArtifactFormatting, type ArtifactFormatting } from "./components/formatter-context";
