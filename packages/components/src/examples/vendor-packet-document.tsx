/**
 * The vendor packet on screen.
 *
 * **Sample material, not a stable API**, for the reason `./examples` gives.
 *
 * Three documents in one scroll, one of each kind, each numbering its own
 * pages: the purchase order paginated live from its tree, the filled W-9
 * painted from the PDF its official layer produced, and the certificate of
 * insurance painted from the bytes the vendor supplied. This is the whole of
 * what a packet preview is; everything specific to it is the labels.
 *
 * The PDFs arrive as bytes rather than being produced here, because both are
 * produced outside the browser: the W-9 by filling its layer, the certificate
 * by whoever issued it. Passing the seal's `parts` in as well labels each
 * document with the packet pages it occupies, so what a reader sees on screen
 * and what the signature map says are visibly the same pages.
 */
/** @jsxRuntime classic */
import React from "react";
import { Bundle } from "../components/bundle";
import { markDocumentRoot } from "@paradoc/react";
import type { PdfPaintReport } from "../components/pdf-pages";
import { Pages } from "../components/pages";
import { Part } from "../components/part";
import { PdfPages } from "../components/pdf-pages";
import type { PagePlan } from "@paradoc/react";
import { PurchaseOrderDocument } from "./purchase-order-document";
import type { PurchaseOrderData } from "./purchase-order-data";
import { purchaseOrderData as defaultPurchaseOrderData } from "./purchase-order-data";
import { VENDOR_PACKET_ANNEX_FILENAME, VENDOR_PACKET_KEYS } from "./vendor-packet";

/** Where one part sits in the packet, as core's bundle seal reports it. */
export interface PacketPlacement {
  /** The bundle content key. */
  key: string;
  /** 1-based packet page the part's first page is. Zero for an attached part. */
  firstPage: number;
  /** Pages the part contributes. Zero for an attached part. */
  pageCount: number;
  /** True when the part is carried beside the packet rather than merged into it. */
  attached?: boolean;
}

export interface VendorPacketDocumentProps {
  /** The purchase order's data. Defaults to the sample's own. */
  purchaseOrderData?: PurchaseOrderData;
  /** The filled W-9, as its PDF layer rendered it. */
  taxpayerPdf: Uint8Array;
  /** The certificate of insurance, as the vendor supplied it. */
  insurancePdf: Uint8Array;
  /** Where each part sits in the packet, when the caller has sealed it. */
  placements?: readonly PacketPlacement[];
  /**
   * The `packetHash` the placements were computed for, and the packet on screen.
   *
   * They are one value here because the packet on screen is the packet that was
   * sealed. A host that lets a document change under a stale seal passes the
   * two separately to `Part`, and each part says its pages are pending until
   * the reseal lands.
   */
  packetHash?: string;
  /** Where pdf.js loads its worker from. See `paintPdfPages`. */
  workerSrc?: string;
  /** Where pdf.js loads the standard fourteen fonts from. See `paintPdfPages`. */
  standardFontDataUrl?: string;
  /** Where pdf.js loads its CMaps from. See `paintPdfPages`. */
  cMapUrl?: string;
  /** How long each PDF part may take to paint before it becomes an attachment. */
  timeoutMs?: number;
  /** Called as each PDF part settles, painted or attached. */
  onPaint?: (key: string, report: PdfPaintReport) => void;
  /** Called with the purchase order's page plan. */
  onPaginate?: (plan: PagePlan) => void;
}

/** The packet, on screen. */
export function VendorPacketDocument({
  purchaseOrderData = defaultPurchaseOrderData,
  taxpayerPdf,
  insurancePdf,
  placements,
  packetHash,
  workerSrc,
  standardFontDataUrl,
  cMapUrl,
  timeoutMs,
  onPaint,
  onPaginate,
}: VendorPacketDocumentProps) {
  const placed = (key: string) => placements?.find((placement) => placement.key === key);
  /** Everything a part needs to say where it sits, or nothing when unsealed. */
  const placement = (key: string) => ({
    firstPage: placed(key)?.firstPage,
    pageCount: placed(key)?.pageCount,
    attached: placed(key)?.attached,
    placedFor: packetHash,
    packetHash,
  });

  return (
    <Bundle id="vendor-packet" className="flex flex-col gap-10">
      <Part
        id={VENDOR_PACKET_KEYS.purchaseOrder}
        kind="composition"
        label="Purchase order · composed live"
        {...placement(VENDOR_PACKET_KEYS.purchaseOrder)}
      >
        <Pages onPaginate={onPaginate}>
          <PurchaseOrderDocument data={purchaseOrderData} />
        </Pages>
      </Part>

      <Part
        id={VENDOR_PACKET_KEYS.taxpayer}
        kind="form"
        label="Form W-9 · filled through its PDF layer"
        {...placement(VENDOR_PACKET_KEYS.taxpayer)}
      >
        <PdfPages
          bytes={taxpayerPdf}
          filename="w-9.pdf"
          workerSrc={workerSrc}
          standardFontDataUrl={standardFontDataUrl}
          cMapUrl={cMapUrl}
          timeoutMs={timeoutMs}
          onPaint={(report) => onPaint?.(VENDOR_PACKET_KEYS.taxpayer, report)}
        />
      </Part>

      <Part
        id={VENDOR_PACKET_KEYS.insurance}
        kind="annex"
        label="Certificate of insurance · annex"
        {...placement(VENDOR_PACKET_KEYS.insurance)}
      >
        <PdfPages
          bytes={insurancePdf}
          filename={VENDOR_PACKET_ANNEX_FILENAME}
          workerSrc={workerSrc}
          standardFontDataUrl={standardFontDataUrl}
          cMapUrl={cMapUrl}
          timeoutMs={timeoutMs}
          onPaint={(report) => onPaint?.(VENDOR_PACKET_KEYS.insurance, report)}
        />
      </Part>
    </Bundle>
  );
}

markDocumentRoot(VendorPacketDocument);
export default VendorPacketDocument;
