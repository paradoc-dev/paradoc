/**
 * Base artifact type shared across all artifact types
 */

import type { Metadata } from "../../primitives";
import type { ContentRef } from "./content-ref";

/**
 * Base properties for all artifact types.
 * Provides common fields like name, version, title, and metadata.
 */
export interface ArtifactBase {
  /** Unique identifier; must follow slug constraints. */
  name: string;
  /** Artifact version (semantic versioning). Required for publishing to registry. */
  version?: string;
  /** Human-friendly name presented to end users. Recommended for published/shared artifacts and directory browsing. */
  title?: string;
  /** Optional long-form description or context. */
  description?: string;
  /** Optional internal code or reference number. */
  code?: string;
  /** Optional ISO date string indicating when the artifact was released/published. */
  releaseDate?: string;
  /** Optional custom metadata map. */
  metadata?: Metadata;
  /** Domain or compliance reference content (e.g., IRS instructions, regulatory guidance). */
  instructions?: ContentRef;
  /** LLM/agent prompts for field ordering, grouping, tone, and presentation guidance. */
  agentInstructions?: ContentRef;
}
