import { describe, it, expect } from 'vitest'
import { classifyRegistryUrl } from '../../src/utils/telemetry.js'

describe('classifyRegistryUrl', () => {
  describe('local registries', () => {
    it('classifies localhost as local', () => {
      expect(classifyRegistryUrl('https://localhost:3000/r')).toBe('local')
    })

    it('classifies 127.0.0.1 as local', () => {
      expect(classifyRegistryUrl('http://127.0.0.1/r')).toBe('local')
    })

    it('classifies ::1 as local', () => {
      expect(classifyRegistryUrl('http://[::1]:8080/r')).toBe('local')
    })

    it('classifies 0.0.0.0 as local', () => {
      expect(classifyRegistryUrl('http://0.0.0.0:4000')).toBe('local')
    })

    it('classifies 10.x.x.x as local', () => {
      expect(classifyRegistryUrl('https://10.0.0.5/registry')).toBe('local')
    })

    it('classifies 172.16.x.x as local', () => {
      expect(classifyRegistryUrl('https://172.16.0.1/r')).toBe('local')
    })

    it('classifies 172.31.x.x as local', () => {
      expect(classifyRegistryUrl('https://172.31.255.255/r')).toBe('local')
    })

    it('classifies 192.168.x.x as local', () => {
      expect(classifyRegistryUrl('https://192.168.1.100/r')).toBe('local')
    })
  })

  describe('private registries', () => {
    it('classifies URL with ${...} env-var tokens as private', () => {
      expect(classifyRegistryUrl('https://${REGISTRY_HOST}/r')).toBe('private')
    })

    it('classifies URL with auth headers as private', () => {
      expect(
        classifyRegistryUrl('https://registry.example.com/r', { hasHeaders: true })
      ).toBe('private')
    })

    it('classifies unparseable URL as private', () => {
      expect(classifyRegistryUrl('not-a-url')).toBe('private')
    })

    it('env-var tokens take priority over localhost', () => {
      expect(classifyRegistryUrl('https://${HOST}:3000/r')).toBe('private')
    })
  })

  describe('public registries', () => {
    it('classifies standard HTTPS URL as public', () => {
      expect(classifyRegistryUrl('https://registry.paradoc.dev/r')).toBe('public')
    })

    it('classifies HTTP URL with public host as public', () => {
      expect(classifyRegistryUrl('http://forms.example.com/r')).toBe('public')
    })

    it('classifies URL without headers as public', () => {
      expect(
        classifyRegistryUrl('https://registry.example.com/r', { hasHeaders: false })
      ).toBe('public')
    })
  })

  describe('edge cases', () => {
    it('172.32.x.x is NOT local (outside private range)', () => {
      expect(classifyRegistryUrl('https://172.32.0.1/r')).toBe('public')
    })

    it('172.15.x.x is NOT local (below private range)', () => {
      expect(classifyRegistryUrl('https://172.15.0.1/r')).toBe('public')
    })

    it('empty string defaults to private', () => {
      expect(classifyRegistryUrl('')).toBe('private')
    })

    it('hasHeaders undefined is treated as no headers', () => {
      expect(
        classifyRegistryUrl('https://registry.example.com/r', {})
      ).toBe('public')
    })
  })
})
