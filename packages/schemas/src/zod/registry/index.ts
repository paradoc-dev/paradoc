/**
 * Registry-related schemas for Paradoc CLI
 *
 * These schemas define the structure for:
 * - Global user config (~/.paradoc/config.json)
 * - Lock files (.paradoc/lock.json)
 * - Registry index (registry.json)
 * - Registry items (r/{name}.json)
 */

export * from './global-config';
export * from './lock';
export * from './registry-index';
export * from './registry-item';
