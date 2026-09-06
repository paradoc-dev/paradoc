/**
 * The sample proposal, sealed through the core seal flow.
 *
 * Sample material. Nothing here is framework surface: it is the reference
 * document's own wiring, kept beside the document so a reader can see what a
 * composition owes the seal end to end.
 *
 * Nothing here re-implements sealing. `@paradoc/core`'s `seal()` runs the whole
 * flow: it decides the signer bindings, renders the layer twice, locates the
 * markers, flattens and hashes the canonical PDF. This module supplies the one
 * thing core does not have, a converter from the artifact's layer to a PDF,
 * and it builds that PDF from the same tree the preview renders.
 *
 * The layer seam itself is generic and lives in `@paradoc/react/pdf` as
 * `parseSigningMarks`. See its module for what the seam costs.
 *
 * **Two findings the seam surfaced.** Both are in the README, and
 * `tests/seal-marker-font.test.tsx` holds the evidence for the first.
 *
 * 1. Flow placement imposes an undocumented font requirement. The marker is
 *    eight braille codepoints drawn from four values, and takumi writes U+0000
 *    for anything the embedded fonts do not cover, so with Inter alone the
 *    marker reaches the PDF as nulls and `locate` throws a `LocateError` naming
 *    every slot as missing, with nothing naming the cause.
 *    `renderPdf({ signingMarkers: true })` embeds a braille face to carry it.
 * 2. Core sizes a flow field from the underscore run beside the marker, so a
 *    signature rule drawn as a border gives it nothing to measure. The
 *    `Signature` block draws core's own placeholder instead.
 */

import { containsEncoding } from "@paradoc/render/pdf";
import type { Form, Person, SealAdapter } from "@paradoc/types";

import type { ProposalData } from "./proposal-data";
import { renderPdf } from "../pdf/render";
import type { PdfImage } from "../pdf/resources";
import { parseSigningMarks } from "../pdf/signing-marks";
import { PROPOSAL_SIGNATURE_SLOTS, proposal } from "./proposal";
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

/** What the adapter needs to rebuild the document for a seal pass. */
export interface ProposalSealAdapterOptions {
  /** The proposal data the document renders. */
  data: ProposalData;
  /** Pre-fetched image bytes, exactly as `renderPdf` takes them. */
  images?: readonly PdfImage[];
  /** Overrides the artifact, for tests that vary it. */
  artifact?: Form;
  /**
   * Embeds the face that carries core's marker codepoints. On by default, and
   * only a test that wants the marker to be lost turns it off.
   */
  signingMarkers?: boolean;
}

/**
 * A `SealAdapter` that converts the signing layer to the document's own PDF.
 *
 * Core calls it twice per seal: once with markers, once clean. The clean call
 * receives core's bare placeholder, which is what the `Signature` block draws
 * on its own, so the sealed document is byte for byte the document
 * `renderPdf` produces with no seal in sight.
 */
export function proposalSealAdapter({
  data,
  images = [],
  artifact,
  signingMarkers = true,
}: ProposalSealAdapterOptions): SealAdapter {
  return {
    async convert({ document }) {
      const content =
        typeof document.content === "string"
          ? document.content
          : new TextDecoder().decode(document.content);
      const { bytes } = await renderPdf(
        <ProposalDocument data={data} artifact={artifact} marks={parseSigningMarks(content, PROPOSAL_SIGNATURE_SLOTS)} />,
        { images, signingMarkers: signingMarkers && containsEncoding(content) }
      );
      return { pdf: bytes };
    },
  };
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
 * Exported so a test can seal the same draft through an adapter of its own; use
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
  return fillProposalForSeal(data).seal({ adapter: proposalSealAdapter({ data, images }) });
}
