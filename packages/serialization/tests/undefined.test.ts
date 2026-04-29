import { describe, it, expect } from "vitest";
import { createSerializer } from "../src/index";

describe("Fallback behavior with undefined", () => {
  it("should use fallback for null values", () => {
    const serializers = createSerializer({
      regionFormat: "us",
      fallbacks: { money: "N/A" },
    });
    expect(serializers.money.stringify(null as unknown as never)).toBe("N/A");
  });

  it("should use fallback for undefined values", () => {
    const serializers = createSerializer({
      regionFormat: "us",
      fallbacks: { money: "N/A" },
    });
    expect(serializers.money.stringify(undefined as unknown as never)).toBe("N/A");
  });

  it("should use fallback for both null and undefined across all types", () => {
    const serializers = createSerializer({
      regionFormat: "us",
      fallbacks: {
        money: "MONEY_NA",
        address: "ADDR_NA",
        phone: "PHONE_NA",
        person: "PERSON_NA",
        organization: "ORG_NA",
      },
    });

    // Test null
    expect(serializers.money.stringify(null as unknown as never)).toBe("MONEY_NA");
    expect(serializers.address.stringify(null as unknown as never)).toBe("ADDR_NA");

    // Test undefined
    expect(serializers.money.stringify(undefined as unknown as never)).toBe("MONEY_NA");
    expect(serializers.address.stringify(undefined as unknown as never)).toBe("ADDR_NA");
    expect(serializers.phone.stringify(undefined as unknown as never)).toBe("PHONE_NA");
    expect(serializers.person.stringify(undefined as unknown as never)).toBe("PERSON_NA");
    expect(serializers.organization.stringify(undefined as unknown as never)).toBe("ORG_NA");
  });
});
