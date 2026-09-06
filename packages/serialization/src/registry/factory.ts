import type {
  SerializerRegistry,
  SerializerConfig,
  Stringifier,
  SerializerFallbacks,
} from "@paradoc/types";
import { REGION_REGISTRIES } from "./base";

function createWrappedStringifier<T>(
  baseStringify: (value: T) => string,
  fallback: string
): Stringifier<T> {
  return {
    stringify: (value: T) => {
      if (value == null) return fallback;
      try {
        return baseStringify(value);
      } catch {
        return fallback;
      }
    },
  };
}

function applyFallbacks(
  registry: SerializerRegistry,
  fallbacks: SerializerFallbacks = {}
): SerializerRegistry {
  const wrap = (key: keyof SerializerRegistry) =>
    createWrappedStringifier(
      (value: unknown) => registry[key].stringify(value as never),
      fallbacks[key] ?? ""
    );

  return {
    money: wrap("money"),
    address: wrap("address"),
    phone: wrap("phone"),
    person: wrap("person"),
    organization: wrap("organization"),
    party: wrap("party"),
    coordinate: wrap("coordinate"),
    bbox: wrap("bbox"),
    duration: wrap("duration"),
    identification: wrap("identification"),
    attachment: wrap("attachment"),
    signature: wrap("signature"),
    date: wrap("date"),
    datetime: wrap("datetime"),
    time: wrap("time"),
    number: wrap("number"),
    percentage: wrap("percentage"),
  };
}

/**
 * Create a custom serializer registry with specified configuration.
 * Applies locale-specific formatting and configured fallback values.
 *
 * @example
 * ```ts
 * const registry = createSerializer({
 *   regionFormat: 'US',
 *   fallbacks: { money: 'N/A', address: '-' }
 * });
 *
 * registry.money.stringify({ amount: 100, currency: 'USD' })
 * // Returns formatted money string, or 'N/A' if serialization fails
 * ```
 */
export function createSerializer(config: SerializerConfig): SerializerRegistry {
  // `REGION_REGISTRIES` is exhaustive over `RegionFormat` by construction, so
  // typed code cannot reach the guard below. A caller that casts past the type
  // gets an error naming what it asked for rather than a different region's
  // formatting: a document quietly rendered in dollars because its registry
  // name was misspelt is the kind of wrong answer nobody reads as wrong.
  const requested = config.regionFormat ?? "us";
  const baseRegistry = REGION_REGISTRIES[requested];
  if (baseRegistry === undefined) {
    throw new Error(
      `No serializer registry named ${JSON.stringify(requested)}. ` +
        `Available: ${Object.keys(REGION_REGISTRIES).join(", ")}.`
    );
  }

  return applyFallbacks(baseRegistry, config.fallbacks);
}
