/**
 * The canonical sample documents the owned components are measured on.
 *
 * **Sample material, not a stable API.** A services proposal — an artifact, two
 * data sets, two token sets and one composition — a short Arabic
 * order-confirmation letter written right to left, a purchase order and the
 * packet that carries it, an invoice nothing signs, and an engagement letter of
 * numbered prose clauses that two parties do. They ship so that the pagination
 * tests, the class probe suite and the parity suite have real documents to
 * measure, and so that a reader has a whole composition to copy from rather
 * than a fragment. Nothing here is framework surface, and anything here may
 * change without a major version.
 *
 * This entry is isomorphic: it is the artifact, the data and the tree. The
 * Node-only half — the logo bytes and the seal wiring — is
 * `src/examples/pdf.ts`, and the PNG itself is beside this module as
 * `proposal-logo.png`.
 *
 * `{Bundle,Document,KeepTogether,Pages,Paper,Field,Section,Table,Part,
 * PdfPages,QRCode,Signature,Totals}Demo` and their per-variant siblings
 * (`FieldVariantDefaultLabel`, `TableVariantCompact`, and so on — one export
 * per alternate configuration, so each can render and show its own source)
 * are smaller demo compositions for the docs site's `/components/<name>`
 * pages: each binds one base component, on its own (or, for `Part` and
 * `PdfPages`, inside the small packet a `Bundle` needs to render
 * meaningfully), to a slice of the same proposal or vendor-packet sample
 * rather than inventing a new artifact. They are read by the docs app both
 * as components (the live Preview and Variants) and as raw source text,
 * rewritten to the form a consumer would write — see
 * `paradoc/apps/docs/scripts/sync-component-docs-content.ts`.
 */

export {
  proposal,
  proposalForm,
  proposalSpec,
  PROPOSAL_REACT_LAYER,
  PROPOSAL_REACT_LAYER_PATH,
  PROPOSAL_SIGNATURE_SLOTS,
} from "./proposal";
export { overflowProposalData, shortProposalData, type ProposalData } from "./proposal-data";
export { ProposalDocument, proposalFormatter, type ProposalDocumentProps } from "./proposal-document";
export {
  purchaseOrder,
  purchaseOrderForm,
  purchaseOrderSpec,
  PURCHASE_ORDER_REACT_LAYER,
  PURCHASE_ORDER_REACT_LAYER_PATH,
  PURCHASE_ORDER_SIGNATURE_SLOTS,
} from "./purchase-order";
export {
  purchaseOrderAnswers,
  purchaseOrderData,
  purchaseOrderDocumentData,
  type PurchaseOrderData,
  type PurchaseOrderPayload,
} from "./purchase-order-data";
export { PurchaseOrderDocument, type PurchaseOrderDocumentProps } from "./purchase-order-document";
export {
  invoice,
  invoiceForm,
  invoiceLogo,
  invoiceSpec,
  invoiceTokens,
  INVOICE_ACCENT_COLOR,
  INVOICE_REACT_LAYER,
  INVOICE_REACT_LAYER_PATH,
} from "./invoice";
export { overflowInvoiceData, shortInvoiceData, type InvoiceData } from "./invoice-data";
export { InvoiceDocument, type InvoiceDocumentProps } from "./invoice-document";
export {
  engagementLetter,
  engagementLetterForm,
  engagementLetterSpec,
  ENGAGEMENT_LETTER_REACT_LAYER,
  ENGAGEMENT_LETTER_REACT_LAYER_PATH,
  ENGAGEMENT_LETTER_SIGNATURE_SLOTS,
} from "./engagement-letter";
export { engagementLetterData, type EngagementLetterData } from "./engagement-letter-data";
export {
  EngagementLetterDocument,
  type EngagementLetterDocumentProps,
} from "./engagement-letter-document";
export { EngagementLetterBlockPreview } from "./engagement-letter-block-preview";
export {
  PROPOSAL_LOGO_HEIGHT_PX,
  PROPOSAL_LOGO_SRC,
  PROPOSAL_LOGO_WIDTH_PX,
} from "./logo";
export {
  brandedProposalLogo,
  brandedProposalTokens,
  BRANDED_ACCENT_COLOR,
} from "./tokens";
export {
  arabicLetter,
  arabicLetterForm,
  arabicLetterSpec,
  arabicLetterTokens,
  ARABIC_LETTER_REACT_LAYER,
  ARABIC_LETTER_REACT_LAYER_PATH,
} from "./arabic-letter";
export { arabicLetterData, type ArabicLetterData } from "./arabic-letter-data";
export {
  ArabicLetterDocument,
  type ArabicLetterDocumentProps,
} from "./arabic-letter-document";
export {
  insuranceCertificate,
  InsuranceCertificateDocument,
  insuranceCertificateData,
  insuranceCertificateForm,
  insuranceCertificateSpec,
  type InsuranceCertificateDocumentProps,
} from "./insurance-certificate";
export {
  vendorPacket,
  vendorPacketBundle,
  vendorPacketSpec,
  VENDOR_PACKET_ANNEX_FILENAME,
  VENDOR_PACKET_ANNEX_PATH,
  VENDOR_PACKET_KEYS,
  VENDOR_PACKET_W9_SLUG,
} from "./vendor-packet";
export {
  VendorPacketDocument,
  type PacketPlacement,
  type VendorPacketDocumentProps,
} from "./vendor-packet-document";
export {
  vendorPacketAnnexBytes,
  vendorPacketData,
  vendorPacketTaxpayerData,
  VENDOR_PACKET_TAXPAYER_SIGNER,
  type VendorPacketData,
} from "./vendor-packet-data";
export { InvoiceBlockPreview } from "./invoice-block-preview";
export { InvoiceBlockVariantOverflow } from "./invoice-block-variant-overflow";
export { PurchaseOrderBlockPreview } from "./purchase-order-block-preview";
export { VendorPacketBlockPreview } from "./vendor-packet-block-preview";
export { BundleDemo } from "./bundle-demo";
export { BundleVariantSingleDocument } from "./bundle-variant-single-document";
export { BundleVariantRow } from "./bundle-variant-row";
export { BundleVariantBrandedTokens } from "./bundle-variant-branded-tokens";
export { DocumentDemo } from "./document-demo";
export { DocumentVariantCustomLayout } from "./document-variant-custom-layout";
export { DocumentVariantCustomFormat } from "./document-variant-custom-format";
export { DocumentVariantBrandedTokens } from "./document-variant-branded-tokens";
export { KeepTogetherDemo } from "./keep-together-demo";
export { KeepTogetherVariantDefaultElement } from "./keep-together-variant-default-element";
export { KeepTogetherVariantCustomElement } from "./keep-together-variant-custom-element";
export { KeepTogetherVariantPassthroughAttributes } from "./keep-together-variant-passthrough-attributes";
export { PagesDemo } from "./pages-demo";
export { PagesVariantMultiPage } from "./pages-variant-multi-page";
export { PagesVariantCustomFrame } from "./pages-variant-custom-frame";
export { PagesVariantPageCount } from "./pages-variant-page-count";
export { PaperDemo } from "./paper-demo";
export { PaperVariantMinimalContent } from "./paper-variant-minimal-content";
export { PaperVariantCustomFrame } from "./paper-variant-custom-frame";
export { PaperVariantOverflowingContent } from "./paper-variant-overflowing-content";
export { FieldDemo } from "./field-demo";
export { FieldVariantDefaultLabel } from "./field-variant-default-label";
export { FieldVariantNoLabel } from "./field-variant-no-label";
export { FieldVariantCustomLabel } from "./field-variant-custom-label";
export { SectionDemo } from "./section-demo";
export { SectionVariantTitled } from "./section-variant-titled";
export { SectionVariantUntitled } from "./section-variant-untitled";
export { SectionVariantRow } from "./section-variant-row";
export { TableDemo } from "./table-demo";
export { TableVariantCompact } from "./table-variant-compact";
export { TableVariantLeftAligned } from "./table-variant-left-aligned";
export { TableVariantCustomHeaders } from "./table-variant-custom-headers";
export { PartDemo } from "./part-demo";
export { PartVariantUnplaced } from "./part-variant-unplaced";
export { PartVariantPlaced } from "./part-variant-placed";
export { PartVariantPending } from "./part-variant-pending";
export { PdfPagesDemo } from "./pdf-pages-demo";
export { PdfPagesVariantStandalone } from "./pdf-pages-variant-standalone";
export { PdfPagesVariantAttachment } from "./pdf-pages-variant-attachment";
export { PdfPagesVariantStyled } from "./pdf-pages-variant-styled";
export { QRCodeDemo } from "./qr-code-demo";
export { QRCodeVariantCustomColors } from "./qr-code-variant-custom-colors";
export { QRCodeVariantLargerSize } from "./qr-code-variant-larger-size";
export { QRCodeVariantCustomLabel } from "./qr-code-variant-custom-label";
export { SignatureDemo } from "./signature-demo";
export { SignatureVariantSignature } from "./signature-variant-signature";
export { SignatureVariantInitials } from "./signature-variant-initials";
export { SignatureVariantCustomId } from "./signature-variant-custom-id";
export { TotalsDemo } from "./totals-demo";
export { TotalsVariantSingleRow } from "./totals-variant-single-row";
export { TotalsVariantWithTaxRate } from "./totals-variant-with-tax-rate";
export { TotalsVariantCustomLabel } from "./totals-variant-custom-label";
