import type {
  SerializerRegistry,
  SerializerConfig,
  Stringifier,
  SerializerFallbacks,
} from "@paradoc/types";
import { usaSerializers, euSerializers } from "./base";

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
  const baseRegistry =
    config.regionFormat === "eu" ? euSerializers : usaSerializers;

  return applyFallbacks(baseRegistry, config.fallbacks);
}
