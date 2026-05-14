/**
 * @paradoc/serialization
 *
 * Primitive serialization for Paradoc framework
 * Locale and region-aware conversion of primitives to strings
 */

// Re-export types from @paradoc/types for convenience
export type { SerializerRegistry, SerializerConfig } from "@paradoc/types";

// Serializers
export * from "./serializers";

// Serializer Registries
export * from "./registry";

// Field detection and preprocessing utilities (for renderers)
export * from "./field-detection";
