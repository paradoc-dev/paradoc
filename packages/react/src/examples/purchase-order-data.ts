/**
 * Sample data for the purchase order.
 *
 * One set, eighteen rows, which is more than the one page of content `Paper`
 * exposes as `PAGE_CONTENT_HEIGHT_PX` (960 pixels: US Letter at 96 dpi less
 * both margins) holds. That is deliberate: the purchase order is the packet's
 * composition, and a packet whose first part is two pages is the only one that
 * proves a part's boxes are offset into packet pages rather than left in the
 * part's own. The table's header repeats on the continued page as it does in
 * any other composition.
 *
 * The proposal sample carries a short and an overflow set because its suite
 * measures pagination against both. This composition has no such need, so
 * there is exactly one set.
 */

import { computeLineAmounts, type LineItemInput } from "../lib/totals";
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
