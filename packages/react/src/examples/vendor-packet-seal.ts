/**
 * The vendor packet, assembled and sealed through core.
 *
 * Sample material. Nothing here re-implements assembly or sealing:
 * `sealBundle` renders each part, flattens it, merges the packet, remaps every
 * slot onto a packet page and hashes the result. What this module supplies is
 * the three things core cannot infer — the renderer that draws the purchase
 * order, the person who signs for each party, and the annex's bytes.
 *
 * The W-9 arrives from the caller rather than from here. `@paradoc/react` does
 * not depend on `@paradoc/essentials`, and it should not: a packet declaration
 * names the parts, and where a part comes from is the application's business.
 * The test and the lab each hand in their own filled draft.
 */

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

import { sealBundle, type DraftForm, type SealedBundle } from "@paradoc/core";
import type { Form, Person, Resolver } from "@paradoc/types";

import { reactLayerRenderers, type ReactLayerRendererOptions } from "../pdf/layer";
import { renderPdf, type RenderPdfOptions } from "../pdf/render";
import {
  InsuranceCertificateDocument,
  insuranceCertificateData,
} from "./insurance-certificate";
import {
  PURCHASE_ORDER_REACT_LAYER,
  PURCHASE_ORDER_REACT_LAYER_PATH,
  purchaseOrder,
} from "./purchase-order";
import { purchaseOrderData, type PurchaseOrderData } from "./purchase-order-data";
import { PurchaseOrderDocument } from "./purchase-order-document";
import {
  VENDOR_PACKET_ANNEX_FILENAME,
  VENDOR_PACKET_ANNEX_PATH,
  VENDOR_PACKET_KEYS,
  vendorPacketBundle,
} from "./vendor-packet";

/** The party roles the purchase order declares a signature slot for. */
export type PurchaseOrderPartyRole = "buyer" | "supplier";

/**
 * The field naming the person who signs for each party.
 *
 * Both parties are organizations and core's `Signer.person` is always a
 * `Person`, so the artifact names a contact for each one and this is where the
 * seal reads it.
 */
const SIGNER_CONTACT_FIELD = {
  buyer: "buyerContact",
  supplier: "supplierContact",
} as const satisfies Record<PurchaseOrderPartyRole, string>;

/** Thrown when the data names no person to sign for a party. */
export class MissingPurchaseOrderSignerError extends Error {
  /** The party role with no signer. */
  readonly role: string;
  /** The field that should have named the person. */
  readonly field: string;

  constructor(role: string, field: string) {
    super(
      `Cannot seal: "${field}" names no person, so the ${role} party has no signatory. ` +
        "Core binds a signer to a Person, and this party is an organization."
    );
    this.name = "MissingPurchaseOrderSignerError";
    this.role = role;
    this.field = field;
  }
}

/**
 * The renderer registry that renders and seals the packet's compositions.
 *
 * One registry serves the whole packet: it is keyed by MIME type, and every
 * composition in the packet is a `text/tsx` layer, so each is bound by its own
 * layer path.
 */
export function vendorPacketRenderers(options: { pdf?: RenderPdfOptions } = {}) {
  const components: NonNullable<ReactLayerRendererOptions["components"]> = {
    [PURCHASE_ORDER_REACT_LAYER_PATH]: PurchaseOrderDocument,
    [PURCHASE_ORDER_REACT_LAYER]: PurchaseOrderDocument,
  };
  return reactLayerRenderers({ components, pdf: options.pdf });
}

const require = createRequire(import.meta.url);

/**
 * The annex as it is checked in.
 *
 * A vendor would upload this. The repository carries the file so a project that
 * installs the vendor packet block has annex bytes without a Node render, and
 * `sealVendorPacket` reads it when the caller supplies none. A browser imports
 * the same file through `@paradoc/react/examples/certificate-of-insurance.pdf`.
 *
 * Resolved through the package's own export map rather than relative to this
 * module, for the reason `logo-image.ts` gives: this module is one file in
 * source and another in the built bundle, and the asset is neither. The export
 * map names one path from both, and it is the path a browser imports too.
 */
export async function insuranceCertificateFixture(): Promise<Uint8Array> {
  const path = require.resolve(`@paradoc/react/examples/${VENDOR_PACKET_ANNEX_PATH}`);
  return new Uint8Array(await readFile(path));
}

/**
 * The annex, redrawn.
 *
 * This is what generated the checked-in file, and the way to regenerate it:
 * `pnpm --filter @paradoc/react regenerate:annex`. The packet treats the bytes
 * exactly as it would treat an upload either way.
 */
export async function insuranceCertificatePdf(options: RenderPdfOptions = {}): Promise<Uint8Array> {
  const { bytes } = await renderPdf(
    InsuranceCertificateDocument({ data: insuranceCertificateData }),
    options
  );
  return bytes;
}

/** The person who signs for a party. @throws {MissingPurchaseOrderSignerError} */
function signerPerson(data: PurchaseOrderData, role: PurchaseOrderPartyRole): Person {
  const field = SIGNER_CONTACT_FIELD[role];
  const contact = data.fields[field];
  if (typeof contact !== "object" || contact === null || typeof (contact as Person).name !== "string") {
    throw new MissingPurchaseOrderSignerError(role, field);
  }
  return contact as Person;
}

/** The id the data carries for the party filling a role. */
function partyId(data: PurchaseOrderData, role: PurchaseOrderPartyRole): string {
  const party = data.parties[role];
  return (Array.isArray(party) ? party[0]! : party!).id;
}

/** Fills the purchase order and binds a signer to each party, ready to seal. */
export function fillPurchaseOrderForSeal(data: PurchaseOrderData = purchaseOrderData) {
  // See `seal.ts`: `DocumentData` carries `Record<string, unknown>` fields and
  // core infers a fully typed payload, and nothing published bridges the two.
  let draft = purchaseOrder.fill({
    fields: data.fields,
    parties: data.parties,
  } as Parameters<typeof purchaseOrder.fill>[0]);

  for (const role of Object.keys(SIGNER_CONTACT_FIELD) as PurchaseOrderPartyRole[]) {
    draft = draft
      .addSigner(`${role}-signer`, { person: signerPerson(data, role) })
      .addSignatory(role, partyId(data, role), { signerId: `${role}-signer` });
  }
  return draft;
}

/** What `sealVendorPacket` needs. */
export interface SealVendorPacketOptions {
  /**
   * The W-9, filled and with a signatory bound to the taxpayer party. It comes
   * from the caller because this package does not depend on the registry.
   */
  taxpayer: DraftForm<Form>;
  /** The certificate of insurance, as the vendor supplied it. Defaults to the checked-in fixture. */
  insurance?: Uint8Array;
  /** The purchase order data. Defaults to the sample's own. */
  purchaseOrderData?: PurchaseOrderData;
  /** Resolves the W-9's PDF layer. `@paradoc/essentials` exports one per artifact. */
  resolver?: Resolver;
  /** Passed through to `renderPdf` for the composition parts. */
  pdf?: RenderPdfOptions;
  /**
   * Which part signers are the same person, as `<part>/<signerId>` to a packet
   * signer id. The sample's three signers are three people, so the default is
   * none.
   */
  signers?: Record<string, string>;
}

/**
 * Assembles and seals the vendor packet.
 *
 * @returns the packet: one merged PDF, one hash over it, one hash over the
 * whole packet, and one signature map whose pages are packet pages.
 */
export async function sealVendorPacket(options: SealVendorPacketOptions): Promise<SealedBundle> {
  return sealBundle(vendorPacketBundle, {
    resolver: options.resolver,
    renderers: vendorPacketRenderers({ pdf: options.pdf }),
    ...(options.signers !== undefined && { signers: options.signers }),
    contents: {
      [VENDOR_PACKET_KEYS.purchaseOrder]: fillPurchaseOrderForSeal(options.purchaseOrderData),
      [VENDOR_PACKET_KEYS.taxpayer]: options.taxpayer,
      [VENDOR_PACKET_KEYS.insurance]: {
        kind: "bytes",
        content: options.insurance ?? (await insuranceCertificateFixture()),
        mimeType: "application/pdf",
        filename: VENDOR_PACKET_ANNEX_FILENAME,
      },
    },
  });
}
