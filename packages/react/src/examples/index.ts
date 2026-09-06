/**
 * `@paradoc/react/examples` — the sample document this package is measured on.
 *
 * **Sample material, not a stable API.** Two documents: a services proposal —
 * an artifact, two data sets, two token sets and one composition — and a short
 * Arabic order-confirmation letter written right to left. They ship so that the
 * pagination tests, the class probe suite and the parity suite have real
 * documents to measure, and so that a reader has a whole composition to copy
 * from rather than a fragment. Nothing here is framework surface, and anything
 * here may change without a major version.
 *
 * This entry is isomorphic: it is the artifact, the data and the tree. The
 * Node-only half — the logo bytes and the seal wiring — is
 * `@paradoc/react/examples/pdf`, and the PNG itself is
 * `@paradoc/react/examples/proposal-logo.png`.
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
export { ProposalDocument, type ProposalDocumentProps } from "./proposal-document";
export {
  purchaseOrder,
  purchaseOrderForm,
  purchaseOrderSpec,
  PURCHASE_ORDER_REACT_LAYER,
  PURCHASE_ORDER_REACT_LAYER_PATH,
  PURCHASE_ORDER_SIGNATURE_SLOTS,
} from "./purchase-order";
export { purchaseOrderData, type PurchaseOrderData } from "./purchase-order-data";
export { PurchaseOrderDocument, type PurchaseOrderDocumentProps } from "./purchase-order-document";
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
