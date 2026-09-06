/**
 * The vendor packet: the sample bundle this package's assembly is measured on.
 *
 * **Sample material, not a stable API**, for the reason `./examples` gives.
 *
 * Three parts, one of each kind a packet can hold, which is the point of it:
 *
 * 1. **A composition.** The purchase order, an artifact with a React layer,
 *    rendered live on screen and to PDF by the renderer registered for
 *    `text/tsx`. Both parties sign it.
 * 2. **A registry PDF form.** The IRS W-9 from `@paradoc/essentials`, filled
 *    through its official PDF layer and signed by the taxpayer. The bundle
 *    names it by its registry slug; the caller supplies the filled draft,
 *    because this package does not depend on the registry to describe a packet
 *    that includes one.
 * 3. **An annex.** A certificate of insurance the vendor supplies as PDF bytes.
 *    The bundle declares what it is; the packet carries the bytes.
 *
 * The bundle is a declaration, not a loader. Nothing here reads a file or
 * resolves a slug: `sealBundle` takes the parts as content entries keyed by
 * these keys, so the same declaration serves a test, a lab and an application
 * that each get their parts from somewhere different.
 */

import { para } from "@paradoc/core";
import type { Bundle, Document } from "@paradoc/types";

import { purchaseOrderForm } from "./purchase-order";

/** The bundle's content keys, so nothing writes one twice. */
export const VENDOR_PACKET_KEYS = {
  /** The composed purchase order. */
  purchaseOrder: "purchase-order",
  /** The registry W-9, filled through its PDF layer. */
  taxpayer: "w-9",
  /** The vendor's certificate of insurance, carried as bytes. */
  insurance: "insurance-certificate",
} as const satisfies Record<string, string>;

/** The registry slug the packet names the W-9 by. */
export const VENDOR_PACKET_W9_SLUG = "@paradoc/essentials/tax/w-9";

/**
 * What the annex is, as the bundle declares it.
 *
 * An uploaded PDF is still a document the packet names, so it is declared like
 * one: a document artifact with a single PDF layer. What the layer's path names
 * is the file the vendor supplied; the packet is handed its bytes rather than
 * reading it.
 */
const insuranceAnnexSpec: Document = {
  kind: "document",
  name: "certificate-of-insurance",
  version: "1.0.0",
  title: "Certificate of Insurance",
  description:
    "Evidence of the vendor's coverage, supplied by the vendor as a PDF. The packet carries the bytes it was given.",
  defaultLayer: "pdf",
  layers: {
    pdf: {
      kind: "file",
      mimeType: "application/pdf",
      path: "certificate-of-insurance.pdf",
      title: "The certificate as supplied",
    },
  },
};

/**
 * The vendor packet bundle, exactly as authored.
 *
 * Annotated rather than `as const`, unlike the form specs beside it. A form's
 * literal types feed the payload `fill` infers; a bundle infers nothing, and
 * `as const` would make `contents` a readonly tuple that `BundleInput`'s
 * mutable `BundleContentItem[]` will not take.
 */
export const vendorPacketSpec: Bundle = {
  kind: "bundle",
  name: "vendor-packet",
  version: "1.0.0",
  title: "Vendor Packet",
  description:
    "What a buyer sends a new supplier: the purchase order to sign, the W-9 to certify a taxpayer identification number, and the vendor's certificate of insurance.",
  metadata: { domain: "commerce" },
  contents: [
    { type: "inline", key: VENDOR_PACKET_KEYS.purchaseOrder, artifact: purchaseOrderForm },
    { type: "registry", key: VENDOR_PACKET_KEYS.taxpayer, slug: VENDOR_PACKET_W9_SLUG },
    { type: "inline", key: VENDOR_PACKET_KEYS.insurance, artifact: insuranceAnnexSpec },
  ],
};

/** The parsed, validated vendor packet. */
export const vendorPacket = para.bundle(vendorPacketSpec);

/** The same validated artifact as a plain `Bundle`, which is what `sealBundle` takes. */
export const vendorPacketBundle: Bundle = vendorPacket.toJSON() as Bundle;

/** The name the packet carries the annex under. */
export const VENDOR_PACKET_ANNEX_FILENAME = "certificate-of-insurance.pdf";

/**
 * The annex bytes, checked in.
 *
 * A block installed into a browser project has no Node and no engine, so it
 * cannot render the certificate to have an annex. The file beside this module
 * is what it imports instead, exported as
 * `@paradoc/react/examples/certificate-of-insurance.pdf`.
 *
 * It is generated, not authored. `insuranceCertificatePdf()` in
 * `@paradoc/react/examples/pdf` draws it from `InsuranceCertificateDocument`
 * with the default adapter, and that is how to regenerate it:
 *
 * ```sh
 * pnpm --filter @paradoc/react regenerate:annex
 * ```
 */
export const VENDOR_PACKET_ANNEX_PATH = "certificate-of-insurance.pdf";
