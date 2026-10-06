/**
 * Base artifact type shared across all artifact types
 */

import type { Metadata } from "../../primitives";
import type { ContentRef } from "./content-ref";

/**
 * One edition of an issued artifact, as printed by its issuer.
 *
 * Issuers reissue forms and documents in editions on their own schedule and label them in
 * their own way ("Rev. March 2024", "3B", "12/01/2023"). An edition is fixed
 * when the artifact is authored: later issuer decisions, such as which edition
 * is current or until when an edition is accepted, are not part of it.
 */
export interface ArtifactEdition {
  /**
   * Stable edition identifier, unique among the editions of one artifact. It is
   * lowercase letters and digits with single hyphens, and not one of current,
   * latest, editions, tags or diff (for example `2024-03` or `3b`). It is the
   * value that coordinates such as `@org/repo/w-9/2024-03` use. It never
   * changes once the edition is published.
   */
  key: string;
  /** The issuer's edition text, exactly as printed (for example "Rev. March 2024"). For display only; never parsed. */
  label: string;
  /** When the issuer released the edition, at the precision the issuer gives: `YYYY`, `YYYY-MM` or `YYYY-MM-DD`. */
  date?: string;
  /** The date the edition takes effect, as an ISO date. Only when the issuer prints one. */
  effectiveFrom?: string;
}

/**
 * Base properties for all artifact types.
 * Provides common fields like name, version, title, and metadata.
 */
export interface ArtifactBase {
  /** JSON Schema URI for this artifact instance: the dated schema address it follows. */
  $schema?: string;
  /**
   * Artifact identifier; must follow slug constraints. Every edition of one
   * form shares the same name: an artifact is identified by its name and,
   * when it has one, its edition key.
   */
  name: string;
  /**
   * Artifact version (semantic versioning). It counts the publisher's own
   * changes to this artifact, never the issuer's edition; each edition has
   * its own version line. Required for publishing to registry.
   */
  version?: string;
  /** Human-friendly name presented to end users. Recommended for published/shared artifacts and directory browsing. */
  title?: string;
  /** Optional long-form description or context. */
  description?: string;
  /** The form number as printed by its issuer (for example `W-9` or `ACORD 25`), or a self-issued form's own number. */
  code?: string;
  /** The organization that issues the form (for example "U.S. Internal Revenue Service"). */
  issuer?: string;
  /** The issuer's edition this artifact encodes. Omitted for artifacts that are not issued in editions. */
  edition?: ArtifactEdition;
  /** BCP 47-style source language tag for this artifact. Defaults to "en" when omitted. */
  language?: string;
  /** Optional custom metadata map. */
  metadata?: Metadata;
  /** Domain or compliance reference content (e.g., IRS instructions, regulatory guidance). */
  instructions?: ContentRef;
  /** LLM/agent prompts for field ordering, grouping, tone, and presentation guidance. */
  agentInstructions?: ContentRef;
}
