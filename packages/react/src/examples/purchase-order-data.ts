/**
 * Sample data for the purchase order.
 *
 * One set, thirty-two rows, which is several times the one page of content
 * `Paper` exposes as `PAGE_CONTENT_HEIGHT_PX` (960 pixels: US Letter at 96 dpi
 * less both margins) holds. That is deliberate, for two reasons. The purchase
 * order is the packet's composition, and a packet whose first part runs to
 * several pages is what proves a part's boxes are offset into packet pages
 * rather than left in the part's own. And the block installs this data: a
 * consumer who renders it should see the table continue across more than one
 * break, with its header copied onto every continued page, rather than a
 * document that happens to spill once.
 *
 * The proposal sample carries a short and an overflow set because its suite
 * measures pagination against both. This composition has no such need, so
 * there is exactly one set.
 */

import { computeLineAmounts, type LineItem, type LineItemInput } from "../lib/totals";
import type { RuntimeParty } from "@paradoc/types";

import type { DocumentData } from "../components/document-context";

const CURRENCY = "USD";
const TAX_RATE_PERCENT = 8.25;

const buyer = {
  name: "Harbor Freight Collective",
  legalName: "Harbor Freight Collective, Inc.",
  domicile: "US",
  entityType: "Corporation",
  taxId: "58-1029384",
};

const supplier = {
  name: "Northgate Systems",
  legalName: "Northgate Systems, LLC",
  domicile: "US",
  entityType: "Limited liability company",
  taxId: "47-2938471",
};

const LINE_ITEMS: LineItemInput[] = [
  { description: "27-inch 4K monitor", quantity: 24, unit: "each", unitPrice: { amount: 385, currency: CURRENCY } },
  { description: "Docking station, USB-C triple display", quantity: 24, unit: "each", unitPrice: { amount: 210, currency: CURRENCY } },
  { description: "Mechanical keyboard and mouse set", quantity: 24, unit: "set", unitPrice: { amount: 95, currency: CURRENCY } },
  { description: "Adjustable monitor arm, dual", quantity: 12, unit: "each", unitPrice: { amount: 165, currency: CURRENCY } },
  { description: "Sit-stand desk frame, 1600mm", quantity: 24, unit: "each", unitPrice: { amount: 620, currency: CURRENCY } },
  { description: "Acoustic desk divider", quantity: 24, unit: "each", unitPrice: { amount: 88, currency: CURRENCY } },
  { description: "48-port managed network switch", quantity: 2, unit: "each", unitPrice: { amount: 1450, currency: CURRENCY } },
  { description: "Wireless access point, Wi-Fi 7", quantity: 6, unit: "each", unitPrice: { amount: 540, currency: CURRENCY } },
  { description: "Cat 6A patch panel, 48 port", quantity: 2, unit: "each", unitPrice: { amount: 310, currency: CURRENCY } },
  { description: "Rack-mount UPS, 3000VA", quantity: 2, unit: "each", unitPrice: { amount: 890, currency: CURRENCY } },
  { description: "Server rack, 24U, with fans", quantity: 1, unit: "each", unitPrice: { amount: 1180, currency: CURRENCY } },
  { description: "Conference room display, 75-inch", quantity: 3, unit: "each", unitPrice: { amount: 1890, currency: CURRENCY } },
  { description: "Video bar with speaker track", quantity: 3, unit: "each", unitPrice: { amount: 1420, currency: CURRENCY } },
  { description: "Badge reader, door controller", quantity: 4, unit: "each", unitPrice: { amount: 395, currency: CURRENCY } },
  { description: "Structured cabling, per drop", quantity: 96, unit: "drop", unitPrice: { amount: 74, currency: CURRENCY } },
  { description: "On-site installation and cable management", quantity: 9, unit: "day", unitPrice: { amount: 750, currency: CURRENCY } },
  { description: "Network configuration and cutover", quantity: 4, unit: "day", unitPrice: { amount: 980, currency: CURRENCY } },
  { description: "Asset tagging and handover documentation", quantity: 2, unit: "day", unitPrice: { amount: 640, currency: CURRENCY } },
  { description: "Task lighting, desk-clamp LED", quantity: 24, unit: "each", unitPrice: { amount: 62, currency: CURRENCY } },
  { description: "Task chair, mesh back, adjustable arms", quantity: 24, unit: "each", unitPrice: { amount: 430, currency: CURRENCY } },
  { description: "Under-desk cable tray, 800mm", quantity: 24, unit: "each", unitPrice: { amount: 34, currency: CURRENCY } },
  { description: "Power module, desk-mounted, 2 socket 2 USB-C", quantity: 24, unit: "each", unitPrice: { amount: 78, currency: CURRENCY } },
  { description: "Locker, personal storage, 4 tier", quantity: 6, unit: "each", unitPrice: { amount: 540, currency: CURRENCY } },
  { description: "Whiteboard, magnetic, 2400mm", quantity: 4, unit: "each", unitPrice: { amount: 295, currency: CURRENCY } },
  { description: "Acoustic ceiling baffle, 1200mm", quantity: 40, unit: "each", unitPrice: { amount: 46, currency: CURRENCY } },
  { description: "Meeting pod, two person, ventilated", quantity: 2, unit: "each", unitPrice: { amount: 6400, currency: CURRENCY } },
  { description: "Fire-rated network cabinet, wall mount", quantity: 2, unit: "each", unitPrice: { amount: 720, currency: CURRENCY } },
  { description: "Environmental sensor, temperature and humidity", quantity: 8, unit: "each", unitPrice: { amount: 118, currency: CURRENCY } },
  { description: "Digital signage player, 4K", quantity: 3, unit: "each", unitPrice: { amount: 340, currency: CURRENCY } },
  { description: "Floor box, four compartment", quantity: 12, unit: "each", unitPrice: { amount: 155, currency: CURRENCY } },
  { description: "Electrical works, per circuit", quantity: 18, unit: "circuit", unitPrice: { amount: 260, currency: CURRENCY } },
  { description: "Site survey and as-built drawings", quantity: 1, unit: "lot", unitPrice: { amount: 2450, currency: CURRENCY } },
];
/**
 * The sample's data, whose parties carry runtime ids.
 *
 * A document only prints a party, so `DocumentData` asks for the wider `Party`.
 * The seal binds a signer to a party by id, so the sample states that its own
 * parties have one rather than asserting it later.
 */
export interface PurchaseOrderData extends DocumentData {
  parties: Record<string, RuntimeParty | RuntimeParty[]>;
}

const { lineItems, subtotalAmount } = computeLineAmounts(LINE_ITEMS, CURRENCY);

/** The purchase order sample: office and IT hardware ordered for a new floor. */
export const purchaseOrderData: PurchaseOrderData = {
  fields: {
    orderNumber: "PO-2026-0512",
    issuedOn: "2026-09-04",
    deliverBy: "2026-10-02",
    buyer,
    buyerAddress: {
      line1: "88 Wharf Road",
      locality: "Oakland",
      region: "CA",
      postalCode: "94607",
      country: "US",
    },
    // Not printed. The seal binds the buyer's signer to this person: core's
    // Signer.person is always a Person, and the party is an organization.
    buyerContact: { name: "Marisol Vega", firstName: "Marisol", lastName: "Vega", title: "Ms." },
    supplier,
    supplierAddress: {
      line1: "1400 Rio Grande Street",
      line2: "Suite 220",
      locality: "Austin",
      region: "TX",
      postalCode: "78701",
      country: "US",
    },
    supplierContact: { name: "Dana Whitfield", firstName: "Dana", lastName: "Whitfield", title: "Ms." },
    shipTo: {
      line1: "88 Wharf Road",
      line2: "Loading Dock B",
      locality: "Oakland",
      region: "CA",
      postalCode: "94607",
      country: "US",
    },
    currency: CURRENCY,
    lineItems,
    subtotalAmount,
    taxRatePercent: TAX_RATE_PERCENT,
    terms: "Payment is due 30 days from delivery. Goods remain the property of the supplier until paid in full.",
  },
  parties: {
    buyer: { id: "buyer-0", ...buyer },
    supplier: { id: "supplier-0", ...supplier },
  },
};

/**
 * What a session has answered, in the artifact's own shape.
 *
 * `@paradoc/sessions` publishes exactly this from `sessionPayload`, and this
 * module states the shape rather than importing it so that a document package
 * does not depend on a session engine to render a document.
 */
export interface PurchaseOrderPayload {
  fields: Record<string, unknown>;
  parties: Record<string, unknown>;
}

/**
 * The document data for a purchase order that is still being answered.
 *
 * Two of the artifact's fields are derived rather than answered, and neither
 * belongs in a session's log: `subtotalAmount`, because the expression language
 * has no aggregate over a list, and each row's `amount`, because it is the row
 * multiplied out. A session collects the rows and the currency; this computes
 * the rest, exactly as the sample above does, and it does so on every call so
 * the totals follow the rows as they land.
 *
 * Everything else passes through untouched. A field nobody has answered yet is
 * simply absent, which is what the composition renders as blank.
 */
export function purchaseOrderDocumentData(payload: PurchaseOrderPayload): PurchaseOrderData {
  const fields: Record<string, unknown> = { ...payload.fields };
  const rows = fields.lineItems;
  const currency = fields.currency;

  // Both, or neither: the amounts are money and money has a currency. Before
  // the currency lands the rows print their own values and the totals print
  // blank, which is the honest state of a document that cannot add up yet.
  if (Array.isArray(rows) && typeof currency === "string" && currency.length > 0) {
    const computed = computeLineAmounts(rows as LineItemInput[], currency);
    fields.lineItems = computed.lineItems;
    fields.subtotalAmount = computed.subtotalAmount;
  }

  return {
    fields,
    // The parties a session answered are validated by the artifact's own party
    // schema before the log records them, so what comes back carries the id a
    // seal binds a signer to.
    parties: payload.parties as PurchaseOrderData["parties"],
  };
}

/**
 * The same sample as a filler would supply it, with nothing derived in it.
 *
 * A session records what it was told, so a script that answers a computed value
 * puts one in an event log that is supposed to hold only answers. This is
 * `purchaseOrderData` with the two derived values taken back out: each row's
 * `amount`, and `subtotalAmount`. Feed it to a fill and
 * `purchaseOrderDocumentData` puts them back.
 */
export const purchaseOrderAnswers: PurchaseOrderPayload = {
  fields: Object.fromEntries(
    Object.entries(purchaseOrderData.fields)
      .filter(([path]) => path !== "subtotalAmount")
      .map(([path, value]) =>
        path === "lineItems" && Array.isArray(value)
          ? [
              path,
              (value as LineItem[]).map(({ amount: _amount, ...row }) => row satisfies LineItemInput),
            ]
          : [path, value]
      )
  ),
  parties: { ...purchaseOrderData.parties },
};
