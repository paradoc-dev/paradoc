/**
 * The sample proposal, sealed through the core seal flow.
 *
 * Sample material. Nothing here is framework surface: it is the reference
 * document's own wiring, kept beside the document so a reader can see what a
 * composition owes the seal end to end. The answer is now short.
 *
 * Nothing here re-implements sealing, and nothing here converts anything.
 * `@paradoc/core`'s `seal()` runs the whole flow: it decides the signer
 * bindings, renders the composition twice through the renderer registered for
 * its layer, locates the markers, checks for drift, flattens and hashes the
 * canonical PDF. The composition's own `Signature` blocks draw the markers,
 * because the layer declares the slots and the renderer is handed them.
 *
 * What this module supplies is the two things core cannot infer: which person
 * signs for each organization party, and the image bytes the document needs.
 *
 * **One finding worth keeping in view**, recorded in the README with
 * `tests/seal-marker-font.test.tsx` as its evidence. Flow placement imposes an
 * undocumented font requirement. The marker is eight braille codepoints, and
 * takumi writes U+0000 for anything the embedded fonts do not cover, so with
 * Inter alone the marker reaches the PDF as nulls. The renderer embeds the
 * braille face on a marker pass, and checks the marker arrived, so the failure
 * now names the slot and the coverage rather than surfacing as an unlocatable
 * placement.
 */

import type { Person } from "@paradoc/types";

import type { ProposalData } from "./proposal-data";
import { reactLayerRenderers } from "@paradoc/react-pdf";
import type { RenderPdfOptions } from "@paradoc/react-pdf";
import type { PdfImage } from "@paradoc/react-pdf";
import { PROPOSAL_REACT_LAYER, PROPOSAL_REACT_LAYER_PATH, PROPOSAL_SIGNATURE_SLOTS, proposal } from "./proposal";
import { ProposalDocument } from "./proposal-document";

/** The party roles the artifact declares a signature slot for. */
export type ProposalPartyRole = keyof typeof PROPOSAL_SIGNATURE_SLOTS;

/**
 * The field naming the person who signs for each party.
 *
 * Core's `Signer.person` is always a `Person`, never an organization, so a
 * signer cannot be the party itself: both of the proposal's parties are
 * organizations. The artifact names a contact for each one and this is where
 * the seal reads it.
 */
const SIGNER_CONTACT_FIELD = {
  provider: "providerContact",
  customer: "customerContact",
} as const satisfies Record<ProposalPartyRole, string>;

/** Thrown when the data names no person to sign for a party. */
export class MissingSignerError extends Error {
  /** The party role with no signer. */
  readonly role: string;
  /** The field that should have named the person. */
  readonly field: string;

  constructor(role: string, field: string) {
    super(
      `Cannot seal: "${field}" names no person, so the ${role} party has no signatory. ` +
        "Core binds a signer to a Person, and this party is an organization."
    );
    this.name = "MissingSignerError";
    this.role = role;
    this.field = field;
  }
}

/** What the sample's renderer registry needs. */
export interface ProposalRenderersOptions {
  /** Pre-fetched image bytes, exactly as `renderPdf` takes them. */
  images?: readonly PdfImage[];
  /**
   * Passed through to `renderPdf`. Only a test that wants the marker lost sets
   * `signingMarkers: false`; the renderer otherwise embeds the face on exactly
   * the passes that carry a marker.
   */
  pdf?: RenderPdfOptions;
}

/**
 * The renderer registry that renders and seals the sample's React layer.
 *
 * The composition is bound by the layer's own path, so nothing here touches the
 * file system and the artifact never picks the component.
 */
export function proposalRenderers({ images = [], pdf }: ProposalRenderersOptions = {}) {
  return reactLayerRenderers({
    components: {
      [PROPOSAL_REACT_LAYER_PATH]: ProposalDocument,
      [PROPOSAL_REACT_LAYER]: ProposalDocument,
    },
    pdf: { images, ...pdf },
  });
}

/** The person who signs for a party. @throws {MissingSignerError} */
function signerPerson(data: ProposalData, role: ProposalPartyRole): Person {
  const field = SIGNER_CONTACT_FIELD[role];
  const contact = data.fields[field];
  if (typeof contact !== "object" || contact === null || typeof (contact as Person).name !== "string") {
    throw new MissingSignerError(role, field);
  }
  return contact as Person;
}

/** The id the data carries for the party filling a role. `RuntimeParty` requires one. */
function partyId(data: ProposalData, role: ProposalPartyRole): string {
  const party = data.parties[role];
  return (Array.isArray(party) ? party[0]! : party!).id;
}

/**
 * Fills the proposal and binds a signer to each party, ready to seal.
 *
 * Exported so a test can seal the same draft through a registry of its own; use
 * `sealProposal` for the ordinary path.
 */
export function fillProposalForSeal(data: ProposalData) {
  // DocumentData carries `Record<string, unknown>` fields, which is what the
  // components need to read a path they are given as a string, and core infers
  // a fully typed payload from the artifact. Nothing published bridges the two,
  // so the payload is asserted here and the README records it.
  let draft = proposal.fill({
    fields: data.fields,
    parties: data.parties,
  } as Parameters<typeof proposal.fill>[0]);

  for (const role of Object.keys(SIGNER_CONTACT_FIELD) as ProposalPartyRole[]) {
    draft = draft
      .addSigner(`${role}-signer`, { person: signerPerson(data, role) })
      .addSignatory(role, partyId(data, role), { signerId: `${role}-signer` });
  }
  return draft;
}

/** What `sealProposal` needs. */
export interface SealProposalOptions {
  /** The proposal data the document renders. */
  data: ProposalData;
  /** Pre-fetched image bytes, exactly as `renderPdf` takes them. */
  images?: readonly PdfImage[];
}

/**
 * Fills the proposal, binds a signer to each party, and seals it through core.
 *
 * @returns the signable form core produced: `signatureMap` carries a resolved
 * box per party and `canonicalPdfHash` the hash of the flattened document.
 */
export async function sealProposal({ data, images = [] }: SealProposalOptions) {
  return fillProposalForSeal(data).seal({ renderers: proposalRenderers({ images }) });
}
