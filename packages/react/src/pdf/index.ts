/**
 * `@paradoc/react/pdf` — the Node-only surface that turns the composed document
 * into PDF bytes and seals it.
 *
 * Everything here is re-exported from a module beside it. `render.ts` holds the
 * one render call, `adapters/` the engines behind it, `layer.ts` the renderer
 * core dispatches to and seals through, and the rest is the vocabulary those
 * are checked against.
 *
 * The sample document's own seal wiring is not here. It is
 * the consumer-owned composition, because it is sample material.
 */

export {
  renderPdf,
  assertDirectionSupported,
  MissingAdapterPeerError,
  UnsupportedDirectionError,
  UnsupportedPdfContentError,
  type PdfAdapter,
  type PdfAdapterName,
  type PdfAdapterOptions,
  type PdfPageGeometry,
  type PdfRenderResult,
  type PreparedPdfInput,
  type RenderPdfOptions,
} from "./render";
export { takumiAdapter } from "./adapters/takumi";
export { withDrawnPaper, withTokenOverride } from "./token-override";
export {
  SigningMarkerProvider,
  useSigningMarks,
  type SigningMarkerProviderProps,
} from "../components/signing-context";
export {
  bindComponent,
  MissingSigningMarkerError,
  reactLayerRenderers,
  reactRenderer,
  UnboundReactLayerError,
  type ReactLayerComponent,
  type ReactLayerComponentProps,
  type ReactLayerRendererOptions,
} from "./layer";
export {
  documentFontFiles,
  markerFontFile,
  pdfFonts,
  type PdfFontFile,
  type PdfImage,
} from "./resources";
export {
  preparePdfTree,
  recordOnce,
  KEEP_ID_ATTRIBUTE,
  KEEP_REPEAT_ATTRIBUTE,
  type PageBreakPlan,
  type PreparedTree,
} from "./tree";
export { PDF_RESET_STYLESHEET } from "./reset";
export {
  INITIAL_VALUE_CLASSES,
  isSupportedClass,
  splitClasses,
  SUPPORTED_CLASS_FAMILIES,
  unsupportedClasses,
  type ClassFamily,
  type ProbeHarness,
} from "./tailwind";
