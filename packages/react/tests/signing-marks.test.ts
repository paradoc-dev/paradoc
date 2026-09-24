/**
 * How a signing block finds its own marker.
 *
 * The markers are keyed by slot, and a block finds its own by naming the party
 * and the field type it draws, so a party that signs and initials keeps two
 * markers apart. The seal that depends on this is tested in
 * `@paradoc/react-pdf` (`tests/seal-two-slots.test.tsx`).
 */

import { describe, expect, it } from "vitest";

import { AmbiguousSigningMarkError, findSigningMark } from "../src/components/signing-context";

const SLOTS = { signature: "tenant-signature", initials: "tenant-initials" } as const;

describe("finding a block's own marker", () => {
  const marks = {
    [SLOTS.signature]: {
      slot: SLOTS.signature,
      role: "tenant",
      index: 0,
      type: "signature" as const,
      marker: "SIG",
    },
    [SLOTS.initials]: {
      slot: SLOTS.initials,
      role: "tenant",
      index: 0,
      type: "initials" as const,
      marker: "INI",
    },
  };

  it("keys on the party and the field type, so two slots on one party stay apart", () => {
    expect(findSigningMark(marks, "tenant", 0, "signature")).toBe("SIG");
    expect(findSigningMark(marks, "tenant", 0, "initials")).toBe("INI");
    expect(findSigningMark(marks, "tenant", 1, "signature")).toBeUndefined();
    expect(findSigningMark(marks, "landlord", 0, "signature")).toBeUndefined();
    expect(findSigningMark({}, "tenant", 0, "signature")).toBeUndefined();
  });

  it("refuses to guess when two flow slots claim the same type on one party", () => {
    const ambiguous = {
      a: { slot: "a", role: "tenant", index: 0, type: "signature" as const, marker: "A" },
      b: { slot: "b", role: "tenant", index: 0, type: "signature" as const, marker: "B" },
    };
    expect(() => findSigningMark(ambiguous, "tenant", 0, "signature")).toThrowError(
      AmbiguousSigningMarkError
    );
    expect(() => findSigningMark(ambiguous, "tenant", 0, "signature")).toThrowError(
      /one flow slot per field type/
    );
  });
});
