/**
 * `@paradoc/react` — compose a document from React components bound to a
 * Paradoc form artifact.
 *
 * One tree is the source of truth for the paginated preview and for the PDF.
 * This entry is what runs in a browser: the components, the document context,
 * the page plan and the preview. `@paradoc/react/pdf` is the Node-only half.
 *
 * The artifact packages — `@paradoc/core`, `@paradoc/types`, `@paradoc/render`
 * and `@paradoc/serialization` — are consumed unchanged.
 */

export { KeepTogether, type KeepTogetherProps } from "./components/keep-together";
export { Bundle, type BundleProps } from "./components/bundle";
export { Document, type DocumentProps } from "./components/document";
export {
  useDocument,
  type DocumentContextValue,
  type DocumentData,
  type SigningMarks,
} from "./components/document-context";
export { Field, type FieldProps } from "./components/field";
export { usePagePlan } from "./components/page-context";
export { Page, Pages, type PageProps, type PagesProps } from "./components/pages";
export {
  Paper,
  Sheet,
  useFitToWidth,
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
export { Section, type SectionProps } from "./components/section";
export { DATE_RULE, Signature, SIGNATURE_RULE, type SignatureProps } from "./components/signature";
export { Table, type TableColumn, type TableProps } from "./components/table";
export { Totals, type TotalRow, type TotalsProps } from "./components/totals";

export {
  itemField,
  pathSegments,
  readValue,
  resolveField,
  UnknownFieldPathError,
} from "./lib/fields";
export {
  BLANK,
  createValueFormatter,
  formatByType,
  type DocumentFormatter,
  type FormatOptions,
  type ValueFormatter,
} from "./lib/format";
export {
  DOCUMENT_FONT_FAMILY,
  DOCUMENT_FONT_NAME,
  DOCUMENT_FONT_PACKAGE,
} from "./lib/font";
export { measureKeeps } from "./lib/measure";
export {
  planPages,
  type MeasuredKeep,
  type OversizeKeep,
  type PagePlan,
} from "./lib/plan";
export { computeLineAmounts, type LineItem, type LineItemInput } from "./lib/totals";
