/**
 * The sample engagement letter, sealed through the core seal flow.
 *
 * Sample material, and deliberately the same shape as `./seal.ts`. Nothing here
 * re-implements sealing and nothing here converts anything: `@paradoc/core`'s
 * `seal()` runs the whole flow — it decides the signer bindings, renders the
 * composition twice through the renderer registered for its layer, locates the
 * markers, checks for drift, flattens and hashes the canonical PDF. The
 * composition's own `Signature` blocks draw the markers, because the layer
 * declares the slots and the renderer is handed them.
 *
 * What this module supplies is the one thing core cannot infer: which person
 * signs for each organization party. The letter names no image, so unlike the
 * proposal it hands the render no bytes at all.
 *
 * The letter is the case where the two slots are further apart than the
 * proposal's: they sit on the last page, below ten clauses of prose that decide
 * where that page starts. `tests/engagement-letter-seal.test.tsx` is what says
 * both markers are still located there.
 */

import type { Person } from "@paradoc/types";

import { reactLayerRenderers } from "@paradoc/react-pdf";
import type { RenderPdfOptions } from "@paradoc/react-pdf";
import type { PdfImage } from "@paradoc/react-pdf";
import {
  engagementLetter,
  ENGAGEMENT_LETTER_REACT_LAYER,
  ENGAGEMENT_LETTER_REACT_LAYER_PATH,
  ENGAGEMENT_LETTER_SIGNATURE_SLOTS,
} from "./engagement-letter";
import type { EngagementLetterData } from "./engagement-letter-data";
import { EngagementLetterDocument } from "./engagement-letter-document";

/** The party roles the artifact declares a signature slot for. */
export type EngagementLetterPartyRole = keyof typeof ENGAGEMENT_LETTER_SIGNATURE_SLOTS;

/**
 * The field naming the person who signs for each party.
 *
 * Core's `Signer.person` is always a `Person`, never an organization, so a
 * signer cannot be the party itself: both of the letter's parties are
 * organizations. The artifact names a contact for each one and this is where
 * the seal reads it.
 */
const SIGNER_CONTACT_FIELD = {
  firm: "firmContact",
  client: "clientContact",
} as const satisfies Record<EngagementLetterPartyRole, string>;

/** Thrown when the data names no person to sign for a party. */
export class MissingEngagementSignerError extends Error {
  /** The party role with no signer. */
  readonly role: string;
  /** The field that should have named the person. */
  readonly field: string;

  constructor(role: string, field: string) {
    super(
      `Cannot seal: "${field}" names no person, so the ${role} party has no signatory. ` +
        "Core binds a signer to a Person, and this party is an organization."
    );
    this.name = "MissingEngagementSignerError";
    this.role = role;
    this.field = field;
  }
}

/** What the sample's renderer registry needs. */
export interface EngagementLetterRenderersOptions {
  /**
   * Pre-fetched image bytes, exactly as `renderPdf` takes them. The letter
   * names no image, so this is empty unless a caller brands it with a mark.
   */
  images?: readonly PdfImage[];
  /**
   * Passed through to `renderPdf`. Only a test that wants the marker lost sets
   * `signingMarkers: false`; the renderer otherwise embeds the face on exactly
   * the passes that carry a marker.
   */
  pdf?: RenderPdfOptions;
}

/**
 * The renderer registry that renders and seals the letter's React layer.
 *
 * The composition is bound by the layer's own path, so nothing here touches the
 * file system and the artifact never picks the component.
 */
export function engagementLetterRenderers({
  images = [],
  pdf,
}: EngagementLetterRenderersOptions = {}) {
  return reactLayerRenderers({
    components: {
      [ENGAGEMENT_LETTER_REACT_LAYER_PATH]: EngagementLetterDocument,
      [ENGAGEMENT_LETTER_REACT_LAYER]: EngagementLetterDocument,
    },
    pdf: { images, ...pdf },
  });
}

/** The person who signs for a party. @throws {MissingEngagementSignerError} */
function signerPerson(data: EngagementLetterData, role: EngagementLetterPartyRole): Person {
  const field = SIGNER_CONTACT_FIELD[role];
  const contact = data.fields[field];
  if (typeof contact !== "object" || contact === null || typeof (contact as Person).name !== "string") {
    throw new MissingEngagementSignerError(role, field);
  }
  return contact as Person;
}

/** The id the data carries for the party filling a role. `RuntimeParty` requires one. */
function partyId(data: EngagementLetterData, role: EngagementLetterPartyRole): string {
  const party = data.parties[role];
  return (Array.isArray(party) ? party[0]! : party!).id;
}

/**
 * Fills the letter and binds a signer to each party, ready to seal.
 *
 * Exported so a test can seal the same draft through a registry of its own; use
 * `sealEngagementLetter` for the ordinary path.
 */
export function fillEngagementLetterForSeal(data: EngagementLetterData) {
  // DocumentData carries `Record<string, unknown>` fields, which is what the
  // components need to read a path they are given as a string, and core infers
  // a fully typed payload from the artifact. Nothing published bridges the two,
  // so the payload is asserted here, exactly as the proposal's seal does.
  let draft = engagementLetter.fill({
    fields: data.fields,
    parties: data.parties,
  } as Parameters<typeof engagementLetter.fill>[0]);

  for (const role of Object.keys(SIGNER_CONTACT_FIELD) as EngagementLetterPartyRole[]) {
    draft = draft
      .addSigner(`${role}-signer`, { person: signerPerson(data, role) })
      .addSignatory(role, partyId(data, role), { signerId: `${role}-signer` });
  }
  return draft;
}

/** What `sealEngagementLetter` needs. */
export interface SealEngagementLetterOptions {
  /** The letter data the document renders. */
  data: EngagementLetterData;
  /** Pre-fetched image bytes, exactly as `renderPdf` takes them. */
  images?: readonly PdfImage[];
}

/**
 * Fills the letter, binds a signer to each party, and seals it through core.
 *
 * @returns the signable form core produced: `signatureMap` carries a resolved
 * box per party and `canonicalPdfHash` the hash of the flattened document.
 */
export async function sealEngagementLetter({ data, images = [] }: SealEngagementLetterOptions) {
  return fillEngagementLetterForSeal(data).seal({
    renderers: engagementLetterRenderers({ images }),
  });
}
