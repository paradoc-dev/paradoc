/**
 * Sample data for the proposal.
 *
 * Two sizes, both measured against the one page of content `Paper` exposes as
 * `PAGE_CONTENT_HEIGHT_PX` (960 pixels: US Letter at 96 dpi less both margins).
 *
 * - `shortProposalData` is 4 rows and measures 924 pixels, so the suite has a
 *   genuine single-page case with 36 pixels to spare.
 * - `overflowProposalData` is 66 rows and measures 3186 pixels, which is 3.32
 *   pages.
 *
 * Both were measured in the lab on the document element, not the sheet, whose
 * `min-height` is a full page. The row counts behind them are asserted in the
 * tests, so shrinking either set fails rather than quietly breaking the budget.
 */

import { computeLineAmounts, type LineItemInput } from "../lib/totals";
import type { RuntimeParty } from "@paradoc/types";

import type { DocumentData } from "../components/document-context";

const CURRENCY = "USD";
const TAX_RATE_PERCENT = 8.25;

const provider = {
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
};

const SHORT_ITEMS: LineItemInput[] = [
  { description: "Discovery workshop and requirements capture", quantity: 3, unit: "day", unitPrice: { amount: 2400, currency: CURRENCY } },
  { description: "Integration architecture and interface design", quantity: 6, unit: "day", unitPrice: { amount: 2200, currency: CURRENCY } },
  { description: "Driver mobile application build", quantity: 18, unit: "day", unitPrice: { amount: 2050, currency: CURRENCY } },
  { description: "Acceptance testing and go-live support", quantity: 5, unit: "day", unitPrice: { amount: 1800, currency: CURRENCY } },
];

const OVERFLOW_TASKS = [
  "Stakeholder alignment",
  "Legacy system inventory",
  "Integration risk register",
  "Reference data cleanup",
  "Environment provisioning",
  "Release pipeline setup",
  "Regional rollout plan",
  "Support handover",
  "Billing reconciliation",
  "Retention policy review",
  "Contract data export",
  "Requirements interview",
  "Process mapping session",
  "Interface contract review",
  "Data profiling pass",
  "Field mapping and transform rules",
  "Reconciliation report",
  "Dispatch board component",
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
  "Operator training session",
  "Cutover rehearsal",
  "Post-launch support week",
  "Documentation pass",
  "Accessibility audit remediation",
];

/** 66 rows: over three full pages of content once the preview paginates. */
const OVERFLOW_ITEMS: LineItemInput[] = OVERFLOW_TASKS.flatMap((task, index) => [
  {
    description: `${task} — phase one`,
    quantity: 1 + (index % 4),
    unit: "day",
    unitPrice: { amount: 1750 + (index % 6) * 125, currency: CURRENCY },
  },
  {
    description: `${task} — phase two`,
    quantity: 2 + (index % 3),
    unit: "day",
    unitPrice: { amount: 1900 + (index % 5) * 110, currency: CURRENCY },
  },
]);

/**
 * The sample's data, whose parties carry runtime ids.
 *
 * A document only prints a party, so `DocumentData` asks for the wider `Party`.
 * The seal binds a signer to a party by id, so the sample states that its own
 * parties have one rather than asserting it later.
 */
export interface ProposalData extends DocumentData {
  parties: Record<string, RuntimeParty | RuntimeParty[]>;
}

function build(
  items: LineItemInput[],
  proposalNumber: string,
  summary: string,
  terms: string
): ProposalData {
  const { lineItems, subtotalAmount } = computeLineAmounts(items, CURRENCY);
  return {
    fields: {
      proposalNumber,
      issuedOn: "2026-09-04",
      validUntil: "2026-10-04",
      provider,
      providerAddress: {
        line1: "1400 Rio Grande Street",
        line2: "Suite 220",
        locality: "Austin",
        region: "TX",
        postalCode: "78701",
        country: "US",
      },
      providerPhone: { number: "+15125550142", type: "work" },
      // Not printed. The seal binds the provider's signer to this person: core's
      // Signer.person is always a Person, and the party is an organization.
      providerContact: { name: "Dana Whitfield", firstName: "Dana", lastName: "Whitfield", title: "Ms." },
      customer,
      customerContact: { name: "Marisol Vega", firstName: "Marisol", lastName: "Vega", title: "Ms." },
      customerAddress: {
        line1: "88 Wharf Road",
        locality: "Oakland",
        region: "CA",
        postalCode: "94607",
        country: "US",
      },
      summary,
      currency: CURRENCY,
      lineItems,
      subtotalAmount,
      taxRatePercent: TAX_RATE_PERCENT,
      terms,
    },
    parties: {
      provider: { id: "provider-0", ...provider },
      customer: { id: "customer-0", ...customer },
    },
  };
}

/** A short proposal, measured to fit inside one page of content. */
export const shortProposalData: ProposalData = build(
  SHORT_ITEMS,
  "PRO-2026-0148",
  "Replace the legacy dispatch system with one integrated platform.",
  "Payment is due 30 days from invoice. Work begins once both parties sign."
);

/** A long proposal, measured to run past three pages. */
export const overflowProposalData: ProposalData = build(
  OVERFLOW_ITEMS,
  "PRO-2026-0149",
  "Full replacement programme for the dispatch, driver, and settlement systems, delivered in two phases across every operating region.",
  "Payment is due 30 days from invoice. Work begins once this proposal is signed by both parties. Either party may end the engagement with 14 days written notice; work completed to that date remains payable."
);
