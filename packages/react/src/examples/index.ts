/**
 * `@paradoc/react/examples` — the sample document this package is measured on.
 *
 * **Sample material, not a stable API.** It is a services proposal: an artifact,
 * two data sets, and one composition. It ships so that the pagination tests,
 * the class probe suite and the parity suite have a real document to measure,
 * and so that a reader has a whole composition to copy from rather than a
 * fragment. Nothing here is framework surface, and anything here may change
 * without a major version.
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
  PROPOSAL_SIGNING_LAYER,
} from "./proposal";
export { overflowProposalData, shortProposalData, type ProposalData } from "./proposal-data";
export { ProposalDocument, type ProposalDocumentProps } from "./proposal-document";
export {
  PROPOSAL_LOGO_HEIGHT_PX,
  PROPOSAL_LOGO_SRC,
  PROPOSAL_LOGO_WIDTH_PX,
} from "./logo";
