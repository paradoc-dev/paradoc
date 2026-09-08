/**
 * Sample data for the invoice.
 *
 * Two sizes, both measured against the one page of content `Paper` exposes as
 * `PAGE_CONTENT_HEIGHT_PX` (960 pixels: US Letter at 96 dpi less both margins),
 * for the reason the proposal carries two: a document that only ever overflows
 * says nothing about the single-page case, and a document that never overflows
 * says nothing about a break.
 *
 * - `shortInvoiceData` is 5 rows and sits inside one page.
 * - `overflowInvoiceData` is 48 rows and runs past two breaks, so the table's
 *   header is copied onto more than one continued page.
 *
 * The row counts are asserted in `tests/invoice-artifact.test.ts`, so shrinking
 * either set fails rather than quietly breaking the budget.
 */

import type { RuntimeParty } from "@paradoc/types";

import type { DocumentData } from "@paradoc/react";
import { computeLineAmounts, type LineItemInput } from "./line-items";

const CURRENCY = "USD";
const TAX_RATE_PERCENT = 8.25;

const issuer = {
  name: "Northgate Systems",
  legalName: "Northgate Systems, LLC",
  domicile: "US",
  entityType: "Limited liability company",
  taxId: "47-2938471",
};

const customer = {
  name: "Harbor Freight Collective",
  legalName: "Harbor Freight Collective, Inc.",
  domicile: "US",
  entityType: "Corporation",
  taxId: "58-1029384",
};

/** Five rows: one month of delivery work, and it fits one page. */
const SHORT_ITEMS: LineItemInput[] = [
  { description: "Integration architecture, senior engineer", quantity: 6, unit: "day", unitPrice: { amount: 2200, currency: CURRENCY } },
  { description: "Dispatch board build", quantity: 11, unit: "day", unitPrice: { amount: 2050, currency: CURRENCY } },
  { description: "Carrier rate ingestion", quantity: 4, unit: "day", unitPrice: { amount: 2050, currency: CURRENCY } },
  { description: "Release engineering and cutover rehearsal", quantity: 3, unit: "day", unitPrice: { amount: 1900, currency: CURRENCY } },
  { description: "Platform subscription, September", quantity: 1, unit: "month", unitPrice: { amount: 3400, currency: CURRENCY } },
];

/** What the long invoice bills for, one entry per work stream. */
const BILLED_WORK = [
  "Dispatch board build",
  "Route optimization service",
  "Driver check-in flow",
  "Proof-of-delivery capture",
  "Carrier rate ingestion",
  "Invoice export adapter",
  "Telemetry dashboard",
  "Alerting and on-call runbook",
  "Access control review",
  "Load test and tuning",
  "Disaster-recovery rehearsal",
  "Operator training",
  "Cutover rehearsal",
  "Post-launch support",
  "Reference data cleanup",
  "Interface contract review",
  "Reconciliation reporting",
  "Documentation pass",
  "Accessibility remediation",
  "Regional rollout support",
  "Billing reconciliation",
  "Support handover",
  "Environment provisioning",
  "Release pipeline maintenance",
];

/** 48 rows: the table continues across more than one break. */
const OVERFLOW_ITEMS: LineItemInput[] = BILLED_WORK.flatMap((work, index) => [
  {
    description: `${work} — August`,
    quantity: 1 + (index % 5),
    unit: "day",
    unitPrice: { amount: 1850 + (index % 6) * 115, currency: CURRENCY },
  },
  {
    description: `${work} — September`,
    quantity: 2 + (index % 4),
    unit: "day",
    unitPrice: { amount: 1950 + (index % 5) * 105, currency: CURRENCY },
  },
]);

/**
 * The sample's data, whose parties carry runtime ids.
 *
 * A document only prints a party, so `DocumentData` asks for the wider `Party`.
 * Nothing signs an invoice, so no seal reads these ids; they are here because a
 * filled artifact carries them and a sample that dropped them would not be one.
 */
export interface InvoiceData extends DocumentData {
  parties: Record<string, RuntimeParty | RuntimeParty[]>;
}

function build(
  items: LineItemInput[],
  invoiceNumber: string,
  notes: string
): InvoiceData {
  const { lineItems, subtotalAmount } = computeLineAmounts(items, CURRENCY);
  return {
    fields: {
      invoiceNumber,
      issuedOn: "2026-10-01",
      dueOn: "2026-10-31",
      issuer,
      issuerAddress: {
        line1: "1400 Rio Grande Street",
        line2: "Suite 220",
        locality: "Austin",
        region: "TX",
        postalCode: "78701",
        country: "US",
      },
      issuerEmail: "billing@northgate-systems.example",
      customer,
      customerAddress: {
        line1: "88 Wharf Road",
        locality: "Oakland",
        region: "CA",
        postalCode: "94607",
        country: "US",
      },
      customerContact: { name: "Marisol Vega", firstName: "Marisol", lastName: "Vega", title: "Ms." },
      purchaseOrderNumber: "PO-2026-0512",
      currency: CURRENCY,
      lineItems,
      subtotalAmount,
      taxRatePercent: TAX_RATE_PERCENT,
      paymentTerms:
        "Payment is due 30 days from the issue date, by transfer to the account on file. Late amounts carry interest at 1.5 percent a month.",
      notes,
    },
    parties: {
      issuer: { id: "issuer-0", ...issuer },
      customer: { id: "customer-0", ...customer },
    },
  };
}

/** A short invoice, sized to fit inside one page of content. */
export const shortInvoiceData: InvoiceData = build(
  SHORT_ITEMS,
  "INV-2026-0431",
  "Quote the invoice number on the transfer so the payment can be matched."
);

/** A long invoice, sized to run its table past more than one page break. */
export const overflowInvoiceData: InvoiceData = build(
  OVERFLOW_ITEMS,
  "INV-2026-0432",
  "Covers the August and September delivery windows on one invoice, as agreed. Quote the invoice number on the transfer so the payment can be matched, and send queries to the billing address above rather than to the delivery team."
);
