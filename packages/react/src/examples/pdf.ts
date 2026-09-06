/**
 * `@paradoc/react/examples/pdf` — the sample document's Node-only half.
 *
 * **Sample material, not a stable API**, for the reason `./examples` gives. It
 * is here rather than beside the document because it reads files and drives the
 * seal, and `./examples` has to load in a browser.
 */

export { proposalLogoImage } from "./logo-image";
export {
  fillProposalForSeal,
  MissingSignerError,
  proposalSealAdapter,
  sealProposal,
  type ProposalPartyRole,
  type ProposalSealAdapterOptions,
  type SealProposalOptions,
} from "./seal";
