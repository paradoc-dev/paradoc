/**
 * What a consumer writes after installing the registry.
 *
 * The suite copies this into the scratch project and type-checks it there, so
 * every item is imported from where it was installed and used the way it is
 * meant to be used. An unreferenced file would type-check even with a broken
 * import; this one references them all, from the paginated preview down to a
 * signature block.
 *
 * The blocks bring their own artifacts and sample data, so every document below
 * is composed entirely from installed files.
 */

import { useRef } from "react";

import { Bundle } from "@/components/paradoc/bundle";
import { Document } from "@/components/paradoc/document";
import { Field } from "@/components/paradoc/field";
import { KeepTogether } from "@/components/paradoc/keep-together";
import { Page, Pages } from "@/components/paradoc/pages";
import { Paper, Sheet, useFitToWidth } from "@/components/paradoc/paper";
import { Section } from "@/components/paradoc/section";
import { Signature } from "@/components/paradoc/signature";
import { Table } from "@/components/paradoc/table";
import { Totals } from "@/components/paradoc/totals";
import { PurchaseOrderDocument } from "@/components/paradoc/purchase-order";
import { VendorPacketDocument } from "@/components/paradoc/vendor-packet";
import { purchaseOrderData } from "@/artifacts/paradoc/purchase-order.data";
import { purchaseOrderForm } from "@/artifacts/paradoc/purchase-order.artifact";
import { vendorPacketBundle } from "@/artifacts/paradoc/vendor-packet.artifact";
import { vendorPacketData } from "@/artifacts/paradoc/vendor-packet.data";
import { planPages, type DocumentTokensInput, type PagePlan } from "@paradoc/react";

/** A tenant's branding, declared at the document root. */
const tokens: DocumentTokensInput = {
  accentColor: "#0f766e",
  fontFamily: "Source Serif 4 Variable",
  pageSize: "a4",
};

/** The composition, paginated. */
export function Proposal({ onPaginate }: { onPaginate?: (plan: PagePlan) => void }) {
  return (
    <Bundle id="proposal-bundle" tokens={tokens}>
      <Document artifact={purchaseOrderForm} data={purchaseOrderData} id="proposal">
        <Pages onPaginate={onPaginate}>
          <Section id="parties" title="Parties" className="flex flex-col gap-2">
            <Field path="orderNumber" />
            <Field path="orderDate" label="Issued" />
          </Section>
          <Section id="line-items" title="Scope and pricing">
            <Table
              path="items"
              id="line-items"
              columns={[
                { field: "description", width: "basis-1/2" },
                { field: "quantity", header: "Qty", align: "right" },
                { field: "unitPrice", header: "Unit price", align: "right" },
                { field: "amount", align: "right" },
              ]}
            />
            <Totals
              rows={[
                { def: "subtotal" },
                { def: "tax" },
                { def: "total", emphasis: true },
              ]}
            />
          </Section>
          <Section id="signatures" title="Signatures">
            <KeepTogether keepId="signature-row" className="flex flex-row gap-8">
              <Signature party="provider" />
              <Signature party="customer" />
              <Signature party="customer" type="initials" />
            </KeepTogether>
          </Section>
        </Pages>
      </Document>
    </Bundle>
  );
}

/**
 * The page furniture on its own: a sheet the consumer scales itself, and one
 * page of a plan it built itself.
 */
export function BareSheet({ plan }: { plan: PagePlan }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const fit = useFitToWidth(frameRef, sheetRef);

  return (
    <div ref={frameRef} style={{ height: fit.height }}>
      <Document artifact={purchaseOrderForm} data={purchaseOrderData}>
        <Page plan={plan} index={0}>
          <Field path="orderNumber" />
        </Page>
      </Document>
      <Sheet page={1} ref={sheetRef} style={{ transform: `scale(${fit.scale})` }}>
        <Document artifact={purchaseOrderForm} data={purchaseOrderData}>
          <Field path="orderNumber" />
        </Document>
      </Sheet>
      <Paper>
        <Document artifact={purchaseOrderForm} data={purchaseOrderData}>
          <Field path="orderNumber" />
        </Document>
      </Paper>
    </div>
  );
}

/** An empty plan, so the fixture does not need a browser to build one. */
export const emptyPlan: PagePlan = planPages([], 720);

/**
 * The purchase order block: the artifact, its sample data and the composition
 * that binds them, all installed. Nothing here is written by the consumer
 * except the `Pages` that paginates it.
 */
export function PurchaseOrder() {
  return (
    <Pages>
      <PurchaseOrderDocument data={purchaseOrderData} artifact={purchaseOrderForm} />
    </Pages>
  );
}

/**
 * The vendor packet block, rendered from its own sample.
 *
 * The annex is bytes the block installs; the W-9's PDF is the one thing the
 * consumer supplies, because filling it needs `@paradoc/essentials` and an
 * engine, which is why the block declares that package as a dependency.
 */
export function VendorPacket({ taxpayer }: { taxpayer: Uint8Array }) {
  return (
    <VendorPacketDocument
      purchaseOrderData={vendorPacketData.purchaseOrder}
      taxpayerPdf={taxpayer}
      insurancePdf={vendorPacketData.insurance}
    />
  );
}

/** The taxpayer values the block ships, as `w9.safeParseData` takes them. */
export const taxpayerValues = vendorPacketData.taxpayer;

/** The packet's own artifact, which is what a caller seals. */
export const packetContentKeys = vendorPacketBundle.contents.map((item) => item.key);
