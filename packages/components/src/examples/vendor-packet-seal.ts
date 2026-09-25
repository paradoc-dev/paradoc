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
import { fileURLToPath } from "node:url";

import { sealBundle, type DraftForm, type SealedBundle } from "@paradoc/core";
import type { Form } from "@paradoc/types";

import { reactLayerRenderers, type ReactLayerRendererOptions } from "@paradoc/react-pdf";
import { renderPdf, type RenderPdfOptions } from "@paradoc/react-pdf";
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
import { PurchaseOrderDocument, purchaseOrderFurniture } from "./purchase-order-document";
import {
  VENDOR_PACKET_ANNEX_FILENAME,
  VENDOR_PACKET_ANNEX_PATH,
  VENDOR_PACKET_KEYS,
  vendorPacketBundle,
} from "./vendor-packet";
import { bindOrganizationSigners } from "./organization-signers";

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


/**
 * The renderer registry that renders and seals the packet's compositions.
 *
 * One registry serves the whole packet: it is keyed by MIME type, and every
 * composition in the packet is a `text/tsx` layer, so each is bound by its own
 * layer path. The order's own furniture numbers its pages, as it numbers the
 * preview's: each part counts its own pages, not the packet's.
 */
export function vendorPacketRenderers(options: { pdf?: RenderPdfOptions } = {}) {
  const components: NonNullable<ReactLayerRendererOptions["components"]> = {
    [PURCHASE_ORDER_REACT_LAYER_PATH]: PurchaseOrderDocument,
    [PURCHASE_ORDER_REACT_LAYER]: PurchaseOrderDocument,
  };
  return reactLayerRenderers({ components, pdf: { furniture: purchaseOrderFurniture, ...options.pdf } });
}

/**
 * The annex as it is checked in.
 *
 * A vendor would upload this. The repository carries the file so a project that
 * installs the vendor packet block has annex bytes without a Node render, and
 * `sealVendorPacket` reads it when the caller supplies none. An installed block
 * carries the same file in its local assets. This canonical source owns the
 * checked-in fixture beside the module.
 */
export async function insuranceCertificateFixture(): Promise<Uint8Array> {
  const path = fileURLToPath(new URL(`./${VENDOR_PACKET_ANNEX_PATH}`, import.meta.url));
  return new Uint8Array(await readFile(path));
}

/**
 * The annex, redrawn.
 *
 * This is what generated the checked-in file, and the way to regenerate it:
 * `pnpm --filter @paradoc/components regenerate:annex`. The packet treats the bytes
 * exactly as it would treat an upload either way.
 */
export async function insuranceCertificatePdf(options: RenderPdfOptions = {}): Promise<Uint8Array> {
  const { bytes } = await renderPdf(
    InsuranceCertificateDocument({ data: insuranceCertificateData }),
    options
  );
  return bytes;
}

/** Fills the purchase order and binds a signer to each party, ready to seal. */
export function fillPurchaseOrderForSeal(data: PurchaseOrderData = purchaseOrderData) {
  // See `seal.ts`: `DocumentData` carries `Record<string, unknown>` fields and
  // core infers a fully typed payload, and nothing published bridges the two.
  let draft = purchaseOrder.fill({
    fields: data.fields,
    parties: data.parties,
  } as Parameters<typeof purchaseOrder.fill>[0]);

  return bindOrganizationSigners(draft, data, SIGNER_CONTACT_FIELD, (current, binding) => current
    .addSigner(binding.signerId, { person: binding.person })
    .addSignatory(binding.role, binding.partyId, { signerId: binding.signerId }));
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
