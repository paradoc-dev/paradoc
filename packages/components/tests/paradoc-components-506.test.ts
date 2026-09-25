import { expect, it } from "vitest";
import { engagementLetterData, shortProposalData } from "../src/examples";
import {
  fillEngagementLetterForSeal,
  fillProposalForSeal,
  MissingEngagementLetterPartyError,
  MissingProposalPartyError,
} from "../src/examples/pdf";

it("proposal seal names the missing customer role", () => {
  const data = { ...shortProposalData, parties: { provider: shortProposalData.parties.provider! } };
  expect(() => fillProposalForSeal(data)).toThrow(MissingProposalPartyError);
  expect(() => fillProposalForSeal(data)).toThrow(/customer/);
});

it("engagement-letter seal names the missing client role", () => {
  const data = {
    ...engagementLetterData,
    parties: { firm: engagementLetterData.parties.firm },
  } as typeof engagementLetterData;
  expect(() => fillEngagementLetterForSeal(data)).toThrow(MissingEngagementLetterPartyError);
  expect(() => fillEngagementLetterForSeal(data)).toThrow(/client/);
});
