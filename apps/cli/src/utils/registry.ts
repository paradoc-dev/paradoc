/**
 * Registry Resolver Utility
 *
 * Handles parsing artifact references and resolving registry URLs.
 */

import { configManager } from './config.js'
import type { ArtifactRef, ResolvedRegistry } from '../types.js'

// Pattern for validating artifact references: @namespace/artifact-name
const ARTIFACT_REF_PATTERN = /^@([a-zA-Z0-9][a-zA-Z0-9-_]*)\/([a-zA-Z0-9][a-zA-Z0-9-_]*)$/

// Pattern for bare namespace: @namespace (no artifact name)
const NAMESPACE_ONLY_PATTERN = /^@([a-zA-Z0-9][a-zA-Z0-9-_]*)$/

/**
 * Result of parsing an artifact argument (either reference or direct URL)
 */
export type ParsedArtifactArg =
  | { type: 'reference'; ref: ArtifactRef }
  | { type: 'url'; artifactUrl: string; baseUrl: string; namespace: string; name: string }

/**
 * Check if a string is a direct URL (must start with https://)
 */
export function isDirectUrl(arg: string): boolean {
  return arg.startsWith('https://')
}

/**
 * Parse an artifact argument - either a @namespace/name reference or a direct URL
 * @param arg - The argument to parse
 * @returns Parsed result or null if invalid
 */
export function parseArtifactArg(arg: string): ParsedArtifactArg | null {
  // Check if it's a direct URL
  if (isDirectUrl(arg)) {
    try {
      const url = new URL(arg)

      // Extract artifact name from URL path (last segment without .json/.yaml extension)
      const pathSegments = url.pathname.split('/').filter(Boolean)
      const lastSegment = pathSegments[pathSegments.length - 1]
      if (!lastSegment) {
        return null
      }

      // Remove file extension (.json, .yaml, .yml)
      const name = lastSegment.replace(/\.(json|yaml|yml)$/i, '')
      if (!name) {
        return null
      }

      // Derive namespace from hostname
      const namespace = `@${url.hostname}`

      // Base URL is protocol + host
      const baseUrl = `${url.protocol}//${url.host}`

      return {
        type: 'url',
        artifactUrl: arg,
        baseUrl,
        namespace,
        name,
      }
    } catch {
      return null
    }
  }

  // Otherwise, try to parse as a reference
  const ref = parseArtifactRef(arg)
  if (ref) {
    return { type: 'reference', ref }
  }

  return null
}

/**
 * Create a ResolvedRegistry from a direct URL
 * @param baseUrl - The base URL (protocol + host, must be HTTPS)
 * @param namespace - The derived namespace (e.g., @registry.acme.com)
 * @param headers - Optional auth headers
 */
export function createRegistryFromUrl(
  baseUrl: string,
  namespace: string,
  headers?: Record<string, string>
): ResolvedRegistry {
  return {
    namespace,
    baseUrl,
    headers,
  }
}

/**
 * Parse an artifact reference string into its components
 * @param ref - Artifact reference (e.g., "@acme/residential-lease")
 * @returns Parsed artifact reference or null if invalid
 */
export function parseArtifactRef(ref: string): ArtifactRef | null {
  const match = ref.match(ARTIFACT_REF_PATTERN)
  if (!match) {
    return null
  }

  const [, namespace, name] = match
  if (!namespace || !name) {
    return null
  }

  return {
    namespace: `@${namespace}`,
    name,
    full: ref,
  }
}

/**
 * Validate an artifact reference string
 * @param ref - Artifact reference to validate
 * @returns true if valid, false otherwise
 */
export function isValidArtifactRef(ref: string): boolean {
  return ARTIFACT_REF_PATTERN.test(ref)
}

/**
 * Resolve registry configuration for a namespace
 * @param namespace - Namespace (with or without @ prefix)
 * @returns Resolved registry configuration
 */
export async function resolveRegistry(namespace: string): Promise<ResolvedRegistry> {
  const normalizedNamespace = namespace.startsWith('@') ? namespace : `@${namespace}`
  const baseUrl = await configManager.getRegistryUrl(normalizedNamespace)
  const headers = await configManager.getRegistryHeaders(normalizedNamespace)

  // Get registry params
  const registry = await configManager.getRegistry(normalizedNamespace)
  const params = registry && typeof registry !== 'string' ? registry.params : undefined

  return {
    namespace: normalizedNamespace,
    baseUrl,
    headers,
    params,
  }
}

/**
 * Build URL for fetching the registry index
 * @param registry - Resolved registry configuration
 * @returns URL for registry.json
 */
export function buildRegistryIndexUrl(registry: ResolvedRegistry): string {
  const baseUrl = registry.baseUrl.replace(/\/$/, '') // Remove trailing slash
  return `${baseUrl}/registry.json`
}

/**
 * Build URL for fetching a specific artifact item
 * @param registry - Resolved registry configuration
 * @param artifactName - Name of the artifact
 * @param itemPath - Optional relative path to the artifact file (overrides default {name}.json)
 * @returns URL for the artifact's item.json
 */
export function buildArtifactItemUrl(registry: ResolvedRegistry, artifactName: string, itemPath?: string): string {
  const baseUrl = registry.baseUrl.replace(/\/$/, '') // Remove trailing slash
  const artifactsPath = registry.artifactsPath || ''
  const suffix = itemPath ? `/${itemPath}` : `/${artifactName}.json`
  return `${baseUrl}${artifactsPath}${suffix}`
}

/**
 * Build URL for downloading a layer file
 * @param registry - Resolved registry configuration
 * @param filePath - Relative path to the file
 * @returns Full URL for the file
 */
export function buildLayerFileUrl(registry: ResolvedRegistry, filePath: string): string {
  const baseUrl = registry.baseUrl.replace(/\/$/, '') // Remove trailing slash
  // If filePath starts with /, don't add another
  const path = filePath.startsWith('/') ? filePath : `/${filePath}`
  return `${baseUrl}${path}`
}

/**
 * Parse and resolve an artifact reference
 * Combines parsing and registry resolution in one step
 * @param ref - Artifact reference string
 * @returns Object with parsed ref and resolved registry, or null if invalid
 */
export async function parseAndResolveArtifact(ref: string): Promise<{
  artifactRef: ArtifactRef
  registry: ResolvedRegistry
} | null> {
  const artifactRef = parseArtifactRef(ref)
  if (!artifactRef) {
    return null
  }

  const registry = await resolveRegistry(artifactRef.namespace)

  return {
    artifactRef,
    registry,
  }
}

/**
 * Format an artifact reference for display
 * @param ref - Artifact reference
 * @returns Formatted string
 */
export function formatArtifactRef(ref: ArtifactRef): string {
  return ref.full
}

/**
 * Extract namespace from artifact reference
 * @param ref - Full artifact reference string
 * @returns Namespace (with @ prefix) or null if invalid
 */
export function extractNamespace(ref: string): string | null {
  const parsed = parseArtifactRef(ref)
  return parsed ? parsed.namespace : null
}

/**
 * Extract artifact name from reference
 * @param ref - Full artifact reference string
 * @returns Artifact name or null if invalid
 */
export function extractArtifactName(ref: string): string | null {
  const parsed = parseArtifactRef(ref)
  return parsed ? parsed.name : null
}

/**
 * Parse a bare namespace argument (e.g., "@acme" without an artifact name)
 * @param arg - The argument to parse
 * @returns Object with namespace or null if not a bare namespace
 */
export function parseNamespaceOnly(arg: string): { namespace: string } | null {
  const match = arg.match(NAMESPACE_ONLY_PATTERN)
  if (!match || !match[1]) {
    return null
  }
  return { namespace: `@${match[1]}` }
}
