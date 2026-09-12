/** @jsxRuntime classic */
import React from "react";
import { useEffect, useState } from "react";

/**
 * Block-preview wrapper for the `/components/blocks/vendor-packet` docs
 * page.
 *
 * `VendorPacketDocument` already self-paginates — it wraps its purchase-order
 * part in its own `Pages` (see `vendor-packet-document.tsx`) — so this
 * wrapper exists for a different reason: `taxpayerPdf` is a required prop the
 * composition takes as already-rendered bytes, and producing those bytes is
 * an async step every consumer does themselves. `insurancePdf` needs no such
 * step — the certificate ships as bytes the block installs — so only the
 * taxpayer PDF is loaded here.
 */

import { w9 } from "@paradoc/essentials";
import { vendorPacketData } from "./vendor-packet-data";
import { VendorPacketDocument } from "./vendor-packet-document";

export function VendorPacketBlockPreview() {
  const [taxpayerPdf, setTaxpayerPdf] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const parsed = w9.safeParseData(vendorPacketData.taxpayer);
    if (!parsed.success) {
      setError("The taxpayer's sample data failed validation against the W-9 artifact.");
      return;
    }
    w9.fill(parsed.data)
      .render({ layer: "pdf" })
      .then((output) => {
        if (cancelled) return;
        if (output instanceof Uint8Array) setTaxpayerPdf(output);
        else setError("Rendering the W-9's PDF layer did not return PDF bytes.");
      })
      .catch(() => {
        if (!cancelled) setError("Rendering the W-9's PDF layer failed.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="p-6 text-sm text-red-600">{error}</p>;
  }

  if (!taxpayerPdf) {
    return <p className="p-6 text-sm text-neutral-500">Rendering the filled W-9&hellip;</p>;
  }

  return (
    <VendorPacketDocument taxpayerPdf={taxpayerPdf} insurancePdf={vendorPacketData.insurance} />
  );
}
