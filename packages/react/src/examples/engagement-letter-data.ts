/**
 * Sample data for the engagement letter.
 *
 * One set, and one is enough. The priced samples carry a short set and an
 * overflow set because their question is where a table breaks, and a table
 * breaks differently at four rows and at sixty. A letter's question is whether
 * a clause of running prose survives the break above it intact and whether the
 * signing blocks stay with the clause they close, and one letter of nine
 * clauses asks both: it runs past the end of the first page, so the plan has a
 * break to place, and it ends in two `Signature` keeps that must not be split.
 *
 * The clause count is asserted in `tests/engagement-letter-artifact.test.ts`,
 * so shortening the letter fails rather than quietly making the second page
 * disappear.
 */

import type { RuntimeParty } from "@paradoc/types";

import type { DocumentData } from "../components/document-context";

const firm = {
  name: "Ashgrove Rowan",
  legalName: "Ashgrove Rowan LLP",
  domicile: "US",
  entityType: "Limited liability partnership",
  taxId: "26-4471903",
};

const client = {
  name: "Harbor Freight Collective",
  legalName: "Harbor Freight Collective, Inc.",
  domicile: "US",
  entityType: "Corporation",
  taxId: "58-1029384",
};

/** One numbered undertaking. The composition renders each as its own keep. */
interface Clause {
  heading: string;
  detail: string;
}

/** Nine clauses: the letter runs onto a second page, so the plan has a break to place. */
const SCOPE: Clause[] = [
  {
    heading: "Advice on the carrier agreements",
    detail:
      "We will review the twelve carrier agreements you have sent us, report on the terms that differ from your standard form, and tell you which of those differences we think matter. The report will be one document covering all twelve rather than one per agreement.",
  },
  {
    heading: "Renegotiation of the two largest",
    detail:
      "We will act for you in renegotiating the agreements with Vantage Line and Colter Haulage, including drafting the amended terms and attending the meetings at which they are discussed. We will not commit you to anything without your written instruction.",
  },
  {
    heading: "Standard form for new carriers",
    detail:
      "We will draft a standard carrier agreement for you to use with new carriers, together with a short note explaining which clauses you may vary in a negotiation and which you should not.",
  },
  {
    heading: "Regulatory review",
    detail:
      "We will review your operations against the federal and state carrier regulations that apply in the four states you operate in, and report anything that needs to change. This review covers the rules as they stand at the effective date; we will tell you about later changes only if you ask us to keep the review current.",
  },
  {
    heading: "Insurance and indemnity terms",
    detail:
      "We will advise on the insurance and indemnity provisions in each agreement, and on whether the cover you hold answers the liabilities those provisions leave with you. We do not advise on whether the cover is competitively priced, which is a matter for your broker.",
  },
  {
    heading: "Disputes short of proceedings",
    detail:
      "We will advise on disputes with carriers and correspond with them on your behalf. If a dispute goes to proceedings we will tell you before it does, and we will agree separate terms with you for that work rather than doing it under this letter.",
  },
  {
    heading: "Data protection in the driver application",
    detail:
      "We will review the notices and consents in your driver application against the privacy laws of the states your drivers work in, and draft replacements for any that do not answer them.",
  },
  {
    heading: "Reporting",
    detail:
      "We will write to you monthly with the position on each part of this engagement, the fees incurred to date, and anything we need a decision on. You may ask for a report at any other time and we will not charge for producing it.",
  },
  {
    heading: "What is not included",
    detail:
      "We are not engaged to advise on tax, on employment matters, or on the law of any country other than the United States. If you want advice on any of those we will agree it with you separately, in writing, before we start.",
  },
];

/**
 * The sample's data, whose parties carry runtime ids.
 *
 * A document only prints a party, so `DocumentData` asks for the wider `Party`.
 * The seal binds a signer to a party by id, so the sample states that its own
 * parties have one rather than asserting it later.
 */
export interface EngagementLetterData extends DocumentData {
  parties: Record<string, RuntimeParty | RuntimeParty[]>;
}

/** The engagement letter sample: a firm engaged on a haulier's carrier contracts. */
export const engagementLetterData: EngagementLetterData = {
  fields: {
    reference: "AR-2026-0917",
    effectiveDate: "2026-09-15",
    matter: "Carrier contracts and regulatory review",
    firm,
    firmAddress: {
      line1: "310 Congress Avenue",
      line2: "Floor 11",
      locality: "Austin",
      region: "TX",
      postalCode: "78701",
      country: "US",
    },
    firmContact: { name: "Priya Raman", firstName: "Priya", lastName: "Raman", title: "Ms." },
    client,
    clientAddress: {
      line1: "88 Wharf Road",
      locality: "Oakland",
      region: "CA",
      postalCode: "94607",
      country: "US",
    },
    clientContact: { name: "Marisol Vega", firstName: "Marisol", lastName: "Vega", title: "Ms." },
    scopeOfServices: SCOPE,
    feeBasis:
      "We charge by the hour at the rates in the schedule we sent you with this letter, reviewed each January. We invoice monthly in arrears, and payment is due 30 days from the invoice date. We will tell you before the fees on any part of this engagement pass the estimate we gave you for it.",
    retainer: { amount: 15000, currency: "USD" },
    term:
      "The engagement begins on the effective date above and runs until the work described in the scope is finished, or until either party ends it under the clause below.",
    termination:
      "Either party may end this engagement by giving 14 days written notice to the other. You are liable for fees and expenses incurred to the date the notice takes effect. Our duty of confidentiality survives the end of the engagement and has no time limit.",
    governingLaw:
      "This engagement is governed by the law of the State of Texas, and the courts of Travis County have exclusive jurisdiction over any dispute arising from it.",
  },
  parties: {
    firm: { id: "firm-0", ...firm },
    client: { id: "client-0", ...client },
  },
};
