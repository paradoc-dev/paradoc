/**
 * `@paradoc/react/examples/pdf` — the sample document's Node-only half.
 *
 * **Sample material, not a stable API**, for the reason `./examples` gives. It
 * is here rather than beside the document because it reads files and drives the
 * seal through the Node-only renderer, and `./examples` has to load in a
 * browser.
 */

export { proposalLogoImage } from "./logo-image";
export {
  fillProposalForSeal,
  MissingSignerError,
  proposalRenderers,
  sealProposal,
  type ProposalPartyRole,
  type ProposalRenderersOptions,
  type SealProposalOptions,
} from "./seal";
