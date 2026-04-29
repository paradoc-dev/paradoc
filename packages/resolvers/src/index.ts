/**
 * @paradoc/resolvers
 *
 * Environment-specific resolvers for Paradoc.
 * Import from subpaths for tree-shaking:
 *
 * @example
 * ```typescript
 * // Direct subpath import (recommended for tree-shaking)
 * import { createFsResolver } from '@paradoc/resolvers'
 *
 * // Umbrella import (convenience)
 * import { createFsResolver } from '@paradoc/resolvers'
 * ```
 */

// Re-export all resolvers for convenience
export * from './fs/index.js'
