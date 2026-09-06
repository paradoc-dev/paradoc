/**
 * Tests for the Arabic registry.
 *
 * Two things are under test and they are separable. The words are Arabic —
 * month names, the meridiem, the currency symbol — which is what makes this a
 * language registry rather than a region one. And the digits are Latin, which
 * is the decision the registry makes and pins in its own locale tag rather than
 * leaving to whichever CLDR the runtime happens to carry.
 *
 * The digit assertions are the ones that would catch a drift, so they are
 * written against the codepoints rather than against a rendered string: a
 * machine whose ICU defaults `ar` to Arabic-Indic must still produce `1234`
 * here, and comparing whole strings would hide which half moved.
 */

import { describe, it, expect } from "vitest";
import { arSerializers, createSerializer, usaSerializers } from "../src/index";

/** True when the string carries no Arabic-Indic digit (U+0660-0669, U+06F0-06F9). */
function latinDigitsOnly(value: string): boolean {
  return !/[٠-٩۰-۹]/u.test(value);
}

describe("arSerializers", () => {
  describe("the numbering system is pinned to Latin digits", () => {
    it("number.stringify groups in Latin digits", () => {
      expect(arSerializers.number.stringify(1234567.891)).toBe("1,234,567.891");
    });

    it("percentage.stringify keeps Latin digits", () => {
      expect(arSerializers.percentage.stringify(15)).toBe("15%");
    });

    it("money.stringify writes Latin digits beside the Arabic currency name", () => {
      const formatted = arSerializers.money.stringify({ amount: 1234.5, currency: "SAR" });
      expect(latinDigitsOnly(formatted)).toBe(true);
      expect(formatted).toContain("1,234.50");
      // The currency is named in Arabic, which is the half that is the language.
      expect(formatted).toMatch(/[؀-ۿ]/u);
    });

    it("defaults to the riyal when the value names no currency", () => {
      expect(arSerializers.money.stringify(100)).toMatch(/[؀-ۿ]/u);
      expect(latinDigitsOnly(arSerializers.money.stringify(100))).toBe(true);
    });

    it("date.stringify names the month in Arabic and the year in Latin digits", () => {
      const formatted = arSerializers.date.stringify("2026-09-04");
      expect(formatted).toContain("2026");
      expect(formatted).toMatch(/[؀-ۿ]/u);
      expect(latinDigitsOnly(formatted)).toBe(true);
    });

    it("datetime.stringify and time.stringify keep Latin digits", () => {
      expect(latinDigitsOnly(arSerializers.datetime.stringify("2026-09-04T15:30:00Z"))).toBe(true);
      expect(latinDigitsOnly(arSerializers.time.stringify("15:30"))).toBe(true);
    });
  });

  describe("everything else behaves the way the other registries do", () => {
    it("date.stringify with an invalid string throws", () => {
      expect(() => arSerializers.date.stringify("not-a-date")).toThrow();
    });

    it("number.stringify with NaN throws", () => {
      expect(() => arSerializers.number.stringify(NaN)).toThrow();
    });

    it("address.stringify keeps the international order the data is written in", () => {
      expect(
        arSerializers.address.stringify({
          line1: "طريق الملك عبدالعزيز",
          locality: "الرياض",
          region: "منطقة الرياض",
          postalCode: "12345",
          country: "SA",
        })
      ).toBe("طريق الملك عبدالعزيز, الرياض, منطقة الرياض, 12345, SA");
    });

    it("phone.stringify returns the E.164 string verbatim, as every registry does", () => {
      expect(arSerializers.phone.stringify({ number: "+966112345678", type: "work" })).toBe(
        usaSerializers.phone.stringify({ number: "+966112345678", type: "work" })
      );
    });

    it("is deterministic across calls", () => {
      expect(arSerializers.number.stringify(42.5)).toBe(arSerializers.number.stringify(42.5));
      expect(arSerializers.date.stringify("2026-09-04")).toBe(
        arSerializers.date.stringify("2026-09-04")
      );
    });
  });

  describe("the factory reaches it by name", () => {
    it("createSerializer({ regionFormat: 'ar' }) is the Arabic registry", () => {
      const serializers = createSerializer({ regionFormat: "ar" });
      expect(serializers.number.stringify(1234.5)).toBe(
        arSerializers.number.stringify(1234.5)
      );
      expect(serializers.date.stringify("2026-09-04")).toBe(
        arSerializers.date.stringify("2026-09-04")
      );
    });

    it("still applies the configured fallbacks", () => {
      const serializers = createSerializer({
        regionFormat: "ar",
        fallbacks: { number: "غير متوفر" },
      });
      expect(serializers.number.stringify(null as never)).toBe("غير متوفر");
    });

    it("is not the US registry, which is what a missing entry would fall back to", () => {
      expect(arSerializers.date.stringify("2026-09-04")).not.toBe(
        usaSerializers.date.stringify("2026-09-04")
      );
    });
  });
});
