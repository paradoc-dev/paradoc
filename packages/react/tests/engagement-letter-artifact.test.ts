/**
 * What the engagement letter artifact promises, checked on the artifact itself.
 *
 * The same claims `proposal-artifact.test.ts` makes, minus the arithmetic: the
 * letter computes nothing, so it declares no `defs` and there is none to
 * evaluate. What it does declare, and what these check, is two signing parties
 * and one flow-placed slot for each, on the single layer the composition is.
 */

import { describe, expect, it } from "vitest";

import {
  engagementLetter,
  engagementLetterData,
  engagementLetterForm,
  ENGAGEMENT_LETTER_REACT_LAYER,
  ENGAGEMENT_LETTER_REACT_LAYER_PATH,
  ENGAGEMENT_LETTER_SIGNATURE_SLOTS,
} from "../../components/src/examples";

describe("the engagement letter artifact", () => {
  it("parses and declares both signing parties", () => {
    expect(Object.keys(engagementLetter.parties ?? {})).toEqual(["firm", "client"]);
    expect(engagementLetter.parties?.firm.signature?.required).toBe(true);
    expect(engagementLetter.parties?.client.signature?.required).toBe(true);
  });

  it("names its composition in a React layer that carries no content", () => {
    const layer = engagementLetterForm.layers?.[ENGAGEMENT_LETTER_REACT_LAYER];
    if (!layer || layer.kind !== "file") throw new Error("the composition layer is not a file layer");
    expect(layer.mimeType).toBe("text/tsx");
    expect(layer.path).toBe(ENGAGEMENT_LETTER_REACT_LAYER_PATH);
    expect(layer.bindings).toBeUndefined();
    expect(layer).not.toHaveProperty("text");
  });

  it("declares one layer, and that layer is the seal target too", () => {
    expect(Object.keys(engagementLetterForm.layers ?? {})).toEqual([ENGAGEMENT_LETTER_REACT_LAYER]);
    expect(engagementLetterForm.defaultLayer).toBe(ENGAGEMENT_LETTER_REACT_LAYER);

    const layer = engagementLetterForm.layers?.[ENGAGEMENT_LETTER_REACT_LAYER];
    expect(Object.keys(layer?.signatures ?? {})).toEqual(
      Object.values(ENGAGEMENT_LETTER_SIGNATURE_SLOTS)
    );
    for (const slot of Object.values(layer?.signatures ?? {})) {
      expect(slot.placement).toBe("flow");
      expect(slot.type).toBe("signature");
    }
    expect(layer?.signatures?.[ENGAGEMENT_LETTER_SIGNATURE_SLOTS.firm]?.party).toEqual({
      role: "firm",
    });
    expect(layer?.signatures?.[ENGAGEMENT_LETTER_SIGNATURE_SLOTS.client]?.party).toEqual({
      role: "client",
    });
  });

  it("computes nothing, because nothing on a letter is arithmetic", () => {
    expect(engagementLetterForm.defs).toBeUndefined();
  });

  it("accepts its sample data, so DocumentData is the payload core expects", () => {
    expect(engagementLetter.safeParseData(engagementLetterData as never).success).toBe(true);
  });
});

describe("the sample letter holds the page budget", () => {
  it("carries enough clauses to run past the first page", () => {
    // Nine clauses of running prose, plus the fee, term and law sections and the
    // two signing blocks, which is a page and a half. Shortening the scope would
    // take the second page away, and a letter that never breaks says nothing
    // about where a clause lands.
    expect((engagementLetterData.fields.scopeOfServices as unknown[]).length).toBe(9);
  });

  it("names a person to sign for each organization party", () => {
    // Core's `Signer.person` is always a `Person` and both parties are
    // organizations, so the seal reads these two fields. Data without them
    // cannot be sealed at all.
    for (const field of ["firmContact", "clientContact"]) {
      expect(engagementLetterData.fields[field]).toHaveProperty("name");
    }
  });
});
