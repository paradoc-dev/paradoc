import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const config = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))

vi.mock('../../src/constants.js', () => ({ VERSION: '9.9.9' }))
vi.mock('../../src/utils/config.js', () => ({
  configManager: {
    loadGlobalConfig: async () => config.value,
    saveGlobalConfig: async () => {},
  },
}))

import {
  telemetryEndpoint,
  trackEvent,
  trackInstall,
  trackRegistryAdd,
} from '../../src/utils/telemetry.js'

const PUBLIC_REGISTRY = 'https://registry.example.com/r/registry.json'

type Sent = { url: string; body: { events: Array<{ name: string; attributes: Record<string, unknown> }> } }

function sentRequests(fetchMock: ReturnType<typeof vi.fn>): Sent[] {
  return fetchMock.mock.calls.map(([url, init]) => ({
    url: String(url),
    body: JSON.parse((init as { body: string }).body),
  }))
}

describe('CLI telemetry transport', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    config.value = { anonymousId: 'anon-1' }
    fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 202 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('PARADOC_TELEMETRY_DISABLED', '')
    vi.stubEnv('DO_NOT_TRACK', '')
    vi.stubEnv('PARADOC_TELEMETRY_URL', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  describe('telemetryEndpoint', () => {
    it('defaults to the production telemetry host', () => {
      expect(telemetryEndpoint({})).toBe('https://telemetry.paradoc.dev/v1/events/anonymous')
    })

    it('honors an origin override and drops any path on it', () => {
      expect(telemetryEndpoint({ PARADOC_TELEMETRY_URL: 'https://telemetry-dev.paradoc.dev/x?y=1' })).toBe(
        'https://telemetry-dev.paradoc.dev/v1/events/anonymous'
      )
    })

    it.each(['not a url', 'ftp://telemetry-dev.paradoc.dev', 'javascript:alert(1)'])(
      'ignores the invalid override %s',
      (value) => {
        expect(telemetryEndpoint({ PARADOC_TELEMETRY_URL: value })).toBe(
          'https://telemetry.paradoc.dev/v1/events/anonymous'
        )
      }
    )
  })

  describe('public install', () => {
    it('sends the usage event and the directory event in one batch to one host', async () => {
      await trackInstall(PUBLIC_REGISTRY, 'w9', '1.2.0', 'form')

      const requests = sentRequests(fetchMock)
      expect(requests).toHaveLength(1)
      expect(requests[0]!.url).toBe('https://telemetry.paradoc.dev/v1/events/anonymous')
      const [usage, directory] = requests[0]!.body.events
      expect(usage!.name).toBe('artifact.installed')
      expect(directory!.name).toBe('directory.installed')
      expect(directory!.attributes).toMatchObject({
        registry_url: 'https://registry.example.com',
        artifact: 'w9',
        version: '1.2.0',
        kind: 'form',
      })
      expect(directory!.attributes).not.toHaveProperty('is_update')
    })

    it('never contacts tasks.paradoc.dev', async () => {
      await trackInstall(PUBLIC_REGISTRY, 'w9', '1.2.0', 'form')
      await trackRegistryAdd(PUBLIC_REGISTRY)
      for (const { url } of sentRequests(fetchMock)) expect(new URL(url).hostname).not.toBe('tasks.paradoc.dev')
    })

    it('omits the directory event when the registry sets enableDirectory: false', async () => {
      await trackInstall(PUBLIC_REGISTRY, 'w9', '1.2.0', 'form', false, { enableDirectory: false })

      const [request] = sentRequests(fetchMock)
      expect(request!.body.events.map((event) => event.name)).toEqual(['artifact.installed'])
    })

    it('sends nothing when the registry sets enableTelemetry: false', async () => {
      await trackInstall(PUBLIC_REGISTRY, 'w9', '1.2.0', 'form', false, { enableTelemetry: false })
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('sends only the private-registry usage event, no directory event, for a private registry', async () => {
      await trackInstall(PUBLIC_REGISTRY, 'w9', '1.2.0', 'form', false, { hasHeaders: true })

      const [request] = sentRequests(fetchMock)
      expect(request!.body.events.map((event) => event.name)).toEqual(['artifact.installed'])
      expect(request!.body.events[0]!.attributes).not.toHaveProperty('artifact')
    })

    it('sends nothing for a local registry', async () => {
      await trackInstall('http://localhost:3000/r', 'w9', '1.2.0', 'form')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('goes to the override origin when PARADOC_TELEMETRY_URL is set', async () => {
      vi.stubEnv('PARADOC_TELEMETRY_URL', 'https://telemetry-dev.paradoc.dev')
      await trackInstall(PUBLIC_REGISTRY, 'w9', '1.2.0', 'form')
      expect(sentRequests(fetchMock).map((request) => request.url)).toEqual([
        'https://telemetry-dev.paradoc.dev/v1/events/anonymous',
      ])
    })
  })

  describe('registry add', () => {
    it('sends one usage event and no directory event', async () => {
      await trackRegistryAdd(PUBLIC_REGISTRY)

      const requests = sentRequests(fetchMock)
      expect(requests).toHaveLength(1)
      expect(requests[0]!.body.events.map((event) => event.name)).toEqual(['registry.added'])
    })
  })

  describe('opt-outs stop every event, directory events included', () => {
    const sendAll = async () => {
      await trackEvent('project.initialized')
      await trackInstall(PUBLIC_REGISTRY, 'w9', '1.2.0', 'form')
      await trackRegistryAdd(PUBLIC_REGISTRY)
    }

    it('sends the baseline when no opt-out is set', async () => {
      await sendAll()
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('honors PARADOC_TELEMETRY_DISABLED=1', async () => {
      vi.stubEnv('PARADOC_TELEMETRY_DISABLED', '1')
      await sendAll()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('honors DO_NOT_TRACK=1', async () => {
      vi.stubEnv('DO_NOT_TRACK', '1')
      await sendAll()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('honors telemetry.enabled: false in the global config', async () => {
      config.value = { anonymousId: 'anon-1', telemetry: { enabled: false } }
      await sendAll()
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('failure handling', () => {
    it('does not reject or throw when the endpoint is unreachable', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'))
      await expect(trackInstall(PUBLIC_REGISTRY, 'w9', '1.2.0', 'form')).resolves.toBeUndefined()
      await expect(trackEvent('project.initialized')).resolves.toBeUndefined()
    })

    it('bounds each request with an abort signal', async () => {
      await trackEvent('project.initialized')
      const init = fetchMock.mock.calls[0]![1] as { signal: AbortSignal }
      expect(init.signal).toBeInstanceOf(AbortSignal)
    })
  })
})
