import { describe, it, expect } from 'vitest'
import {
  RegistryFetchError,
  FileSizeExceededError,
  RequestTimeoutError,
  UrlValidationError,
} from '../../src/utils/registry-client.js'

describe('Registry Client Error Classes', () => {
  describe('RegistryFetchError', () => {
    it('creates error with status code and url', () => {
      const error = new RegistryFetchError('Not found', 404, 'https://example.com/artifact.json')
      expect(error.name).toBe('RegistryFetchError')
      expect(error.message).toBe('Not found')
      expect(error.statusCode).toBe(404)
      expect(error.url).toBe('https://example.com/artifact.json')
    })

    it('creates error without optional fields', () => {
      const error = new RegistryFetchError('General error')
      expect(error.name).toBe('RegistryFetchError')
      expect(error.statusCode).toBeUndefined()
      expect(error.url).toBeUndefined()
    })
  })

  describe('FileSizeExceededError', () => {
    it('creates error with size details', () => {
      const error = new FileSizeExceededError(
        'File too large',
        'https://example.com/layer.pdf',
        50 * 1024 * 1024, // 50MB
        20 * 1024 * 1024 // 20MB limit
      )
      expect(error.name).toBe('FileSizeExceededError')
      expect(error.message).toBe('File too large')
      expect(error.url).toBe('https://example.com/layer.pdf')
      expect(error.size).toBe(50 * 1024 * 1024)
      expect(error.limit).toBe(20 * 1024 * 1024)
    })
  })

  describe('RequestTimeoutError', () => {
    it('creates error with url', () => {
      const error = new RequestTimeoutError('Request timed out', 'https://example.com/slow')
      expect(error.name).toBe('RequestTimeoutError')
      expect(error.message).toBe('Request timed out')
      expect(error.url).toBe('https://example.com/slow')
    })
  })

  describe('UrlValidationError', () => {
    it('creates error with url', () => {
      const error = new UrlValidationError('Blocked internal IP', 'http://127.0.0.1/secret')
      expect(error.name).toBe('UrlValidationError')
      expect(error.message).toBe('Blocked internal IP')
      expect(error.url).toBe('http://127.0.0.1/secret')
    })
  })
})

describe('Security Constants', () => {
  it('has reasonable file size limits', async () => {
    const { SECURITY_LIMITS } = await import('../../src/utils/constants.js')

    // Artifact size should be limited
    expect(SECURITY_LIMITS.MAX_ARTIFACT_SIZE).toBeLessThanOrEqual(10 * 1024 * 1024) // Max 10MB
    expect(SECURITY_LIMITS.MAX_ARTIFACT_SIZE).toBeGreaterThan(0)

    // Layer size should be limited
    expect(SECURITY_LIMITS.MAX_LAYER_SIZE).toBeLessThanOrEqual(100 * 1024 * 1024) // Max 100MB
    expect(SECURITY_LIMITS.MAX_LAYER_SIZE).toBeGreaterThan(0)

    // Index size should be limited
    expect(SECURITY_LIMITS.MAX_INDEX_SIZE).toBeLessThanOrEqual(50 * 1024 * 1024) // Max 50MB
    expect(SECURITY_LIMITS.MAX_INDEX_SIZE).toBeGreaterThan(0)
  })

  it('has reasonable network timeouts', async () => {
    const { NETWORK_TIMEOUTS } = await import('../../src/utils/constants.js')

    // Connect timeout should be reasonable (not too short, not too long)
    expect(NETWORK_TIMEOUTS.CONNECT_TIMEOUT).toBeGreaterThanOrEqual(5000) // At least 5 seconds
    expect(NETWORK_TIMEOUTS.CONNECT_TIMEOUT).toBeLessThanOrEqual(120000) // Max 2 minutes

    // Read timeout
    expect(NETWORK_TIMEOUTS.READ_TIMEOUT).toBeGreaterThanOrEqual(10000)
    expect(NETWORK_TIMEOUTS.READ_TIMEOUT).toBeLessThanOrEqual(300000)

    // Download timeout (for large files)
    expect(NETWORK_TIMEOUTS.DOWNLOAD_TIMEOUT).toBeGreaterThanOrEqual(60000)
    expect(NETWORK_TIMEOUTS.DOWNLOAD_TIMEOUT).toBeLessThanOrEqual(600000)
  })
})
