/**
 * The canonical sample documents' Node-only rendering and sealing helpers.
 *
 * **Sample material, not a stable API**, for the reason `./examples` gives. It
 * is here rather than beside the document because it reads files and drives the
 * seal through the Node-only renderer, and `./examples` has to load in a
 * browser.
 */

export { proposalLogoImage } from "./logo-image";
export {
  engagementLetterRenderers,
  fillEngagementLetterForSeal,
  MissingEngagementSignerError,
  sealEngagementLetter,
  type EngagementLetterPartyRole,
  type EngagementLetterRenderersOptions,
  type SealEngagementLetterOptions,
} from "./engagement-letter-seal";
export {
  fillProposalForSeal,
  MissingSignerError,
  proposalRenderers,
  sealProposal,
  type ProposalPartyRole,
  type ProposalRenderersOptions,
  type SealProposalOptions,
} from "./seal";
export {
  fillPurchaseOrderForSeal,
  insuranceCertificateFixture,
  insuranceCertificatePdf,
  MissingPurchaseOrderSignerError,
  sealVendorPacket,
  vendorPacketRenderers,
  type PurchaseOrderPartyRole,
  type SealVendorPacketOptions,
} from "./vendor-packet-seal";
