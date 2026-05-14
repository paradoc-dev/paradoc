/**
 * Telemetry Service
 *
 * Tracks anonymous CLI usage events. Fire-and-forget — never blocks commands.
 *
 * Opt-out:
 *   - Set `telemetry.enabled: false` in ~/.paradoc/config.json
 *   - Set `OFM_TELEMETRY_DISABLED=1` or `DO_NOT_TRACK=1` env vars
 *   - Pass `--no-telemetry` flag to any command
 *
 * Debug:
 *   - Set `OFM_TELEMETRY_DEBUG=1` to log events to console
 */

import { randomUUID } from 'node:crypto'
import { platform, arch, release } from 'node:os'
import { configManager } from './config.js'
import { VERSION } from '../constants.js'

const TELEMETRY_ENDPOINT = 'https://telemetry.paradoc.dev/v1/events'
const SEND_TIMEOUT_MS = 5_000

// Session ID — unique per process invocation
const sessionId = randomUUID()

export interface TelemetryEvent {
  source: 'cli'
  version: number
  type: string
  anonymousId: string
  sessionId: string
  timestamp: string
  cliVersion: string
  nodeVersion: string
  os: string
  arch: string
  ci: boolean
  success: boolean
  durationMs?: number
  errorMessage?: string
  properties?: Record<string, unknown>
}

/**
 * Detect if running in a CI environment
 */
function isCI(): boolean {
  const env = process.env
  return !!(
    env.CI ||
    env.GITHUB_ACTIONS ||
    env.GITLAB_CI ||
    env.CIRCLECI ||
    env.TRAVIS ||
    env.JENKINS_URL ||
    env.BUILDKITE ||
    env.TF_BUILD ||
    env.CODEBUILD_BUILD_ID
  )
}

/**
 * Check if telemetry is enabled based on config and env vars
 */
async function isTelemetryEnabled(): Promise<boolean> {
  // Never send telemetry in dev mode (running from source)
  if (VERSION === 'dev') return false

  // Env var opt-outs (highest priority)
  if (process.env.OFM_TELEMETRY_DISABLED === '1') return false
  if (process.env.DO_NOT_TRACK === '1') return false

  // Config-based opt-out
  try {
    const config = await configManager.loadGlobalConfig()
    if (config.telemetry?.enabled === false) return false
  } catch {
    // If config can't be loaded, default to enabled
  }

  return true
}

/**
 * Get or create the persistent anonymous ID.
 * Stored in ~/.paradoc/config.json under `anonymousId`.
 */
async function getAnonymousId(): Promise<string> {
  try {
    const config = await configManager.loadGlobalConfig()

    if (config.anonymousId) {
      return config.anonymousId
    }

    // Generate and persist a new ID
    const newId = randomUUID()
    config.anonymousId = newId
    await configManager.saveGlobalConfig(config)
    return newId
  } catch {
    // If we can't persist, use a transient ID
    return randomUUID()
  }
}

/** Schema version for CLI telemetry events. Bump when the shape changes. */
const SCHEMA_VERSION = 1

/**
 * Build a telemetry event
 */
async function buildEvent(
  type: string,
  opts: {
    success?: boolean
    durationMs?: number
    errorMessage?: string
    properties?: Record<string, unknown>
  } = {}
): Promise<TelemetryEvent> {
  const anonymousId = await getAnonymousId()

  return {
    source: 'cli',
    version: SCHEMA_VERSION,
    type,
    anonymousId,
    sessionId,
    timestamp: new Date().toISOString(),
    cliVersion: VERSION,
    nodeVersion: process.version,
    os: `${platform()}/${release()}`,
    arch: arch(),
    ci: isCI(),
    success: opts.success ?? true,
    ...(opts.durationMs !== undefined && { durationMs: opts.durationMs }),
    ...(opts.errorMessage && { errorMessage: opts.errorMessage.slice(0, 200) }),
    ...(opts.properties && { properties: opts.properties }),
  }
}

/**
 * Send events to the telemetry endpoint.
 * Uses AbortController for a hard timeout.
 */
async function sendEvents(events: TelemetryEvent[]): Promise<void> {
  const endpoint = TELEMETRY_ENDPOINT
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS)

  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(events),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Track a CLI event.
 *
 * @param type - Event type in `resource.action` format (e.g. `project.initialized`)
 *
 * Fire-and-forget — errors are silently swallowed.
 * Use `OFM_TELEMETRY_DEBUG=1` to see events in the console.
 */
export async function trackEvent(
  type: string,
  opts: {
    success?: boolean
    durationMs?: number
    errorMessage?: string
    properties?: Record<string, unknown>
  } = {}
): Promise<void> {
  if (!(await isTelemetryEnabled())) return

  const event = await buildEvent(type, opts)

  if (process.env.OFM_TELEMETRY_DEBUG) {
    console.log('[telemetry]', JSON.stringify(event, null, 2))
  }

  sendEvents([event]).catch(() => {
    // Silently ignore — telemetry must never block or fail visibly
  })
}

export type RegistryType = 'local' | 'private' | 'public'

/**
 * Check if a hostname resolves to a private IP range.
 * Covers 10.x.x.x, 172.16-31.x.x, 192.168.x.x.
 */
function isPrivateIP(hostname: string): boolean {
  if (/^10\./.test(hostname)) return true
  if (/^192\.168\./.test(hostname)) return true
  const match = hostname.match(/^172\.(\d+)\./)
  if (match) {
    const second = parseInt(match[1]!, 10)
    if (second >= 16 && second <= 31) return true
  }
  return false
}

/**
 * Classify a registry URL for telemetry purposes.
 *
 * - `local`   — localhost, loopback, private IPs → skip telemetry entirely
 * - `private` — has auth headers, contains `${...}` env-var tokens, or unparseable → track only that it happened
 * - `public`  — everything else → track with full details
 */
export function classifyRegistryUrl(
  url: string,
  opts?: { hasHeaders?: boolean }
): RegistryType {
  // Env-var tokens → private (URL not fully resolved)
  if (/\$\{[^}]+\}/.test(url)) return 'private'

  // Auth headers present → private
  if (opts?.hasHeaders) return 'private'

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return 'private' // unparseable → safe default
  }

  const hostname = parsed.hostname

  // Loopback / local addresses
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' || hostname === '[::1]' ||
    hostname === '0.0.0.0'
  ) {
    return 'local'
  }

  // Private IP ranges
  if (isPrivateIP(hostname)) return 'local'

  return 'public'
}

/**
 * Track an artifact install/update event with privacy-aware classification.
 *
 * - Local registries → skip entirely
 * - Private registries → send only `{ registryType, isUpdate }`
 * - Public registries → send full details
 */
export async function trackInstall(
  registryUrl: string,
  artifact: string,
  version: string,
  kind: string,
  isUpdate: boolean = false,
  opts?: { hasHeaders?: boolean }
): Promise<void> {
  const registryType = classifyRegistryUrl(registryUrl, opts)

  if (registryType === 'local') return

  if (registryType === 'private') {
    return trackEvent('artifact.installed', {
      properties: { registryType, isUpdate },
    })
  }

  return trackEvent('artifact.installed', {
    properties: {
      registryType,
      registryUrl,
      artifact,
      version,
      kind,
      isUpdate,
    },
  })
}

/**
 * Track a registry add event with privacy-aware classification.
 *
 * - Local registries → skip entirely
 * - Private registries → send only `{ registryType }`
 * - Public registries → send `{ registryType, registryUrl }`
 */
export async function trackRegistryAdd(
  url: string,
  opts?: { hasHeaders?: boolean }
): Promise<void> {
  const registryType = classifyRegistryUrl(url, opts)

  if (registryType === 'local') return

  if (registryType === 'private') {
    return trackEvent('registry.added', {
      properties: { registryType },
    })
  }

  return trackEvent('registry.added', {
    properties: { registryType, registryUrl: url },
  })
}
