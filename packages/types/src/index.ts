/**
 * @paradoc/types
 *
 * Core types for the Paradoc framework.
 */

// Re-export all schemas (definition-time types)
export type * from './schemas/index.js';

// Re-export all runtime types (filled forms, parties, etc.)
export type * from './runtime/index.js';

// Re-export all interfaces
export type * from './interfaces/index.js';
