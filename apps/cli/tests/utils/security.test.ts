import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import {
  sanitizePath,
  validateUrl,
  sanitizeForDisplay,
  isValidSemver,
  validateDownloadedArtifact,
  assertNotSymlink,
  SymlinkError,
} from '../../src/utils/security.js'

describe('sanitizePath', () => {
  const baseDir = '/project/artifacts/@acme'

  describe('valid paths', () => {
    it('accepts simple file name', () => {
      const result = sanitizePath(baseDir, 'layer.pdf')
      expect(result).toBe(path.join(baseDir, 'layer.pdf'))
    })

    it('accepts file in subdirectory', () => {
      const result = sanitizePath(baseDir, 'templates/layer.pdf')
      expect(result).toBe(path.join(baseDir, 'templates/layer.pdf'))
    })

    it('accepts deeply nested paths', () => {
      const result = sanitizePath(baseDir, 'a/b/c/d/file.txt')
      expect(result).toBe(path.join(baseDir, 'a/b/c/d/file.txt'))
    })

    it('normalizes redundant slashes', () => {
      const result = sanitizePath(baseDir, 'templates//layer.pdf')
      expect(result).toBe(path.join(baseDir, 'templates/layer.pdf'))
    })

    it('normalizes internal ./ references', () => {
      const result = sanitizePath(baseDir, './layer.pdf')
      expect(result).toBe(path.join(baseDir, 'layer.pdf'))
    })
  })

  describe('path traversal attacks', () => {
    it('rejects simple parent directory traversal', () => {
      const result = sanitizePath(baseDir, '../secret.txt')
      expect(result).toBeNull()
    })

    it('rejects deep parent directory traversal', () => {
      const result = sanitizePath(baseDir, '../../../etc/passwd')
      expect(result).toBeNull()
    })

    it('rejects traversal disguised with subdirectory', () => {
      const result = sanitizePath(baseDir, 'subdir/../../secret.txt')
      expect(result).toBeNull()
    })

    it('allows path that escapes but returns to same location', () => {
      // This path goes up and comes back to the same directory - it's safe
      // because the final destination is still within baseDir
      const result = sanitizePath(baseDir, '../@acme/layer.pdf')
      expect(result).toBe(path.join(baseDir, 'layer.pdf'))
    })

    it('rejects traversal to sibling directory', () => {
      // This path escapes to a sibling directory
      const result = sanitizePath(baseDir, '../@other/secret.txt')
      expect(result).toBeNull()
    })

    it('rejects absolute paths outside base', () => {
      const result = sanitizePath(baseDir, '/etc/passwd')
      expect(result).toBeNull()
    })

    it('rejects absolute paths even if they seem related', () => {
      const result = sanitizePath(baseDir, '/project/other/file.txt')
      expect(result).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('handles empty file path', () => {
      const result = sanitizePath(baseDir, '')
      // Empty path resolves to baseDir itself, which is valid
      expect(result).toBe(baseDir)
    })

    it('handles path with only dots', () => {
      const result = sanitizePath(baseDir, '...')
      // '...' is a valid filename (not a traversal)
      expect(result).toBe(path.join(baseDir, '...'))
    })

    it('handles hidden files', () => {
      const result = sanitizePath(baseDir, '.hidden-file')
      expect(result).toBe(path.join(baseDir, '.hidden-file'))
    })

    it('handles hidden directories', () => {
      const result = sanitizePath(baseDir, '.hidden/file.txt')
      expect(result).toBe(path.join(baseDir, '.hidden/file.txt'))
    })
  })
})
describe('validateUrl', () => {
  describe('valid URLs', () => {
    it('accepts HTTPS URLs', () => {
      const result = validateUrl('https://example.com/artifact.json')
      expect(result.valid).toBe(true)
      expect(result.url?.hostname).toBe('example.com')
      expect(result.warnings).toHaveLength(0)
    })

    it('accepts URLs with ports', () => {
      const result = validateUrl('https://example.com:8080/artifact.json')
      expect(result.valid).toBe(true)
    })

    it('accepts URLs with query strings', () => {
      const result = validateUrl('https://example.com/artifact.json?version=1.0')
      expect(result.valid).toBe(true)
    })
  })

  describe('HTTP and HTTPS support', () => {
    it('accepts HTTP URLs', () => {
      const result = validateUrl('http://example.com/artifact.json')
      expect(result.valid).toBe(true)
    })

    it('accepts localhost URLs', () => {
      const result = validateUrl('http://localhost:4567/artifact.json')
      expect(result.valid).toBe(true)
    })

    it('accepts private IP URLs', () => {
      const result = validateUrl('http://192.168.1.1/artifact.json')
      expect(result.valid).toBe(true)
    })
  })

  describe('invalid URL syntax', () => {
    it('rejects malformed URLs', () => {
      const result = validateUrl('not-a-url')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Invalid URL syntax')
    })

    it('rejects empty strings', () => {
      const result = validateUrl('')
      expect(result.valid).toBe(false)
    })
  })

  describe('unsupported schemes', () => {
    it('rejects file:// URLs', () => {
      const result = validateUrl('file:///etc/passwd')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Only HTTP(S) is allowed')
    })

    it('rejects ftp:// URLs', () => {
      const result = validateUrl('ftp://example.com/file.txt')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Only HTTP(S) is allowed')
    })

    it('rejects javascript: URLs', () => {
      const result = validateUrl('javascript:alert(1)')
      expect(result.valid).toBe(false)
    })

    it('rejects data: URLs', () => {
      const result = validateUrl('data:text/html,<script>alert(1)</script>')
      expect(result.valid).toBe(false)
    })
  })
})



describe('sanitizeForDisplay', () => {
  it('returns normal text unchanged', () => {
    expect(sanitizeForDisplay('Hello World')).toBe('Hello World')
    expect(sanitizeForDisplay('artifact-name_123')).toBe('artifact-name_123')
  })

  it('removes ANSI escape sequences', () => {
    expect(sanitizeForDisplay('\x1B[31mRed Text\x1B[0m')).toBe('Red Text')
    expect(sanitizeForDisplay('\x1B[1;32mBold Green\x1B[0m')).toBe('Bold Green')
  })

  it('removes null bytes', () => {
    expect(sanitizeForDisplay('Hello\x00World')).toBe('HelloWorld')
  })

  it('removes other control characters', () => {
    expect(sanitizeForDisplay('Hello\x07World')).toBe('HelloWorld') // Bell
    expect(sanitizeForDisplay('Hello\x08World')).toBe('HelloWorld') // Backspace
  })

  it('preserves newlines and tabs', () => {
    expect(sanitizeForDisplay('Hello\nWorld')).toBe('Hello\nWorld')
    expect(sanitizeForDisplay('Hello\tWorld')).toBe('Hello\tWorld')
  })

  it('handles empty/null input', () => {
    expect(sanitizeForDisplay('')).toBe('')
  })
})

describe('isValidSemver', () => {
  it('accepts valid semver versions', () => {
    expect(isValidSemver('1.0.0')).toBe(true)
    expect(isValidSemver('0.1.0')).toBe(true)
    expect(isValidSemver('10.20.30')).toBe(true)
  })

  it('accepts versions with prerelease', () => {
    expect(isValidSemver('1.0.0-alpha')).toBe(true)
    expect(isValidSemver('1.0.0-beta.1')).toBe(true)
    expect(isValidSemver('1.0.0-rc.1')).toBe(true)
  })

  it('accepts versions with build metadata', () => {
    expect(isValidSemver('1.0.0+build123')).toBe(true)
    expect(isValidSemver('1.0.0-alpha+build')).toBe(true)
  })

  it('rejects invalid versions', () => {
    expect(isValidSemver('')).toBe(false)
    expect(isValidSemver('1')).toBe(false)
    expect(isValidSemver('1.0')).toBe(false)
    expect(isValidSemver('v1.0.0')).toBe(false)
    expect(isValidSemver('1.0.0.0')).toBe(false)
  })

  it('rejects leading zeros, empty prerelease and trailing text', () => {
    expect(isValidSemver('01.0.0')).toBe(false)
    expect(isValidSemver('1.0.0-01')).toBe(false)
    expect(isValidSemver('1.0.0-')).toBe(false)
    expect(isValidSemver('1.0.0evil')).toBe(false)
  })
})



describe('validateDownloadedArtifact', () => {
  describe('valid artifacts', () => {
    it('validates a complete form artifact', () => {
      const artifact = {
        name: 'test-form',
        kind: 'form',
        version: '1.0.0',
        title: 'Test Form',
        fields: [{ name: 'field1', type: 'text' }],
      }
      const result = validateDownloadedArtifact(artifact)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('validates W9 artifact structure', () => {
      // W9 artifact from test-registry
      const w9Artifact = {
        name: 'w9',
        kind: 'form',
        version: '1.0.0',
        title: 'Request for Taxpayer Identification Number and Certification',
        description: 'IRS Form W-9 - Request for Taxpayer Identification Number and Certification',
        tags: ['irs', 'tax', 'w9', 'tin', 'government'],
        fields: {
          name: { type: 'text', label: 'Name', required: true },
          taxClassification: { type: 'enum', label: 'Federal Tax Classification', required: true },
          ssn: { type: 'text', label: 'Social Security Number' },
          ein: { type: 'text', label: 'Employer Identification Number' },
        },
        layers: {
          pdf: {
            kind: 'file',
            mimeType: 'application/pdf',
            path: 'w9.pdf',
          },
        },
      }
      const result = validateDownloadedArtifact(w9Artifact)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('validates a complete checklist artifact', () => {
      const artifact = {
        name: 'test-checklist',
        kind: 'checklist',
        version: '1.0.0',
        title: 'Test Checklist',
        items: [{ title: 'Item 1' }],
      }
      const result = validateDownloadedArtifact(artifact)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('validates a complete bundle artifact', () => {
      const artifact = {
        name: 'test-bundle',
        kind: 'bundle',
        version: '1.0.0',
        title: 'Test Bundle',
        items: [{ ref: '@acme/form1' }],
      }
      const result = validateDownloadedArtifact(artifact)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('validates a complete document artifact', () => {
      const artifact = {
        name: 'test-document',
        kind: 'document',
        version: '1.0.0',
        title: 'Test Document',
      }
      const result = validateDownloadedArtifact(artifact)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('required fields', () => {
    it('rejects artifact without name', () => {
      const artifact = {
        kind: 'form',
        version: '1.0.0',
      }
      const result = validateDownloadedArtifact(artifact)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("Missing required field: 'name'")
    })

    it('rejects artifact without kind', () => {
      const artifact = {
        name: 'test-artifact',
        version: '1.0.0',
      }
      const result = validateDownloadedArtifact(artifact)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("Missing required field: 'kind'")
    })

    it('rejects artifact with invalid kind', () => {
      const artifact = {
        name: 'test-artifact',
        kind: 'invalid-kind',
        version: '1.0.0',
      }
      const result = validateDownloadedArtifact(artifact)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Invalid artifact kind')
    })
  })

  describe('name validation', () => {
    it('rejects name with invalid format', () => {
      const artifact = {
        name: '-invalid-name',
        kind: 'form',
      }
      const result = validateDownloadedArtifact(artifact)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Invalid artifact name format')
    })

    it('rejects name with consecutive hyphens', () => {
      const artifact = {
        name: 'invalid--name',
        kind: 'form',
      }
      const result = validateDownloadedArtifact(artifact)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Invalid artifact name format')
    })

    it('warns when name does not match expected', () => {
      const artifact = {
        name: 'actual-name',
        kind: 'form',
        title: 'Test',
      }
      const result = validateDownloadedArtifact(artifact, 'expected-name')
      expect(result.valid).toBe(true)
      expect(result.warnings.some((w) => w.includes('does not match expected'))).toBe(true)
    })
  })

  describe('version validation', () => {
    it('warns about non-semver version', () => {
      const artifact = {
        name: 'test-artifact',
        kind: 'form',
        version: 'v1.0',
        title: 'Test',
      }
      const result = validateDownloadedArtifact(artifact)
      expect(result.valid).toBe(true) // Non-critical
      expect(result.warnings.some((w) => w.includes('not valid SemVer'))).toBe(true)
    })

    it('accepts valid semver version', () => {
      const artifact = {
        name: 'test-artifact',
        kind: 'form',
        version: '1.0.0',
        title: 'Test',
      }
      const result = validateDownloadedArtifact(artifact)
      expect(result.warnings.some((w) => w.includes('semver'))).toBe(false)
    })
  })

  describe('layer validation', () => {
    it('validates layers with correct structure', () => {
      const artifact = {
        name: 'test-artifact',
        kind: 'form',
        title: 'Test',
        layers: {
          pdf: {
            kind: 'file',
            path: 'layer.pdf',
            mimeType: 'application/pdf',
          },
          text: {
            kind: 'inline',
            text: 'Hello',
            mimeType: 'text/plain',
          },
        },
      }
      const result = validateDownloadedArtifact(artifact)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('rejects file layer without path', () => {
      const artifact = {
        name: 'test-artifact',
        kind: 'form',
        title: 'Test',
        layers: {
          pdf: {
            kind: 'file',
            mimeType: 'application/pdf',
          },
        },
      }
      const result = validateDownloadedArtifact(artifact)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes("missing required field 'path'"))).toBe(true)
    })

    it('rejects inline layer without text', () => {
      const artifact = {
        name: 'test-artifact',
        kind: 'form',
        title: 'Test',
        layers: {
          text: {
            kind: 'inline',
            mimeType: 'text/plain',
          },
        },
      }
      const result = validateDownloadedArtifact(artifact)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes("missing required field 'text'"))).toBe(true)
    })

    it('rejects layer with invalid kind', () => {
      const artifact = {
        name: 'test-artifact',
        kind: 'form',
        title: 'Test',
        layers: {
          invalid: {
            kind: 'unknown',
            mimeType: 'text/plain',
          },
        },
      }
      const result = validateDownloadedArtifact(artifact)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('invalid kind'))).toBe(true)
    })

    it('warns about missing mimeType', () => {
      const artifact = {
        name: 'test-artifact',
        kind: 'form',
        title: 'Test',
        layers: {
          pdf: {
            kind: 'file',
            path: 'layer.pdf',
          },
        },
      }
      const result = validateDownloadedArtifact(artifact)
      expect(result.valid).toBe(true) // Non-critical
      expect(result.warnings.some((w) => w.includes('mimeType'))).toBe(true)
    })
  })

  describe('kind-specific validation', () => {
    it('warns when form has no fields or fieldsets', () => {
      const artifact = {
        name: 'test-form',
        kind: 'form',
        title: 'Test Form',
      }
      const result = validateDownloadedArtifact(artifact)
      expect(result.warnings.some((w) => w.includes('fields'))).toBe(true)
    })

    it('warns when checklist has no items', () => {
      const artifact = {
        name: 'test-checklist',
        kind: 'checklist',
        title: 'Test Checklist',
      }
      const result = validateDownloadedArtifact(artifact)
      expect(result.warnings.some((w) => w.includes('items'))).toBe(true)
    })

    it('warns when bundle has no items', () => {
      const artifact = {
        name: 'test-bundle',
        kind: 'bundle',
        title: 'Test Bundle',
      }
      const result = validateDownloadedArtifact(artifact)
      expect(result.warnings.some((w) => w.includes('items'))).toBe(true)
    })
  })

  describe('display field sanitization', () => {
    it('warns about control characters in title', () => {
      const artifact = {
        name: 'test-artifact',
        kind: 'form',
        title: 'Test\x00Title',
      }
      const result = validateDownloadedArtifact(artifact)
      expect(result.warnings.some((w) => w.includes('control characters'))).toBe(true)
    })

    it('warns about ANSI sequences in description', () => {
      const artifact = {
        name: 'test-artifact',
        kind: 'form',
        title: 'Test',
        description: '\x1B[31mRed text\x1B[0m',
      }
      const result = validateDownloadedArtifact(artifact)
      expect(result.warnings.some((w) => w.includes('control characters'))).toBe(true)
    })
  })

  describe('missing recommended fields', () => {
    it('warns about missing title', () => {
      const artifact = {
        name: 'test-artifact',
        kind: 'form',
      }
      const result = validateDownloadedArtifact(artifact)
      expect(result.warnings.some((w) => w.includes("Missing recommended field: 'title'"))).toBe(
        true
      )
    })
  })
})



describe('assertNotSymlink', () => {
  let testDir: string
  let testFile: string
  let testSymlink: string

  beforeEach(async () => {
    // Create a unique test directory
    testDir = path.join(tmpdir(), `symlink-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await fs.mkdir(testDir, { recursive: true })
    testFile = path.join(testDir, 'regular-file.txt')
    testSymlink = path.join(testDir, 'symlink-file.txt')
  })

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  it('allows writing to non-existent path', async () => {
    const nonExistent = path.join(testDir, 'does-not-exist.txt')
    await expect(assertNotSymlink(nonExistent)).resolves.toBeUndefined()
  })

  it('allows writing to regular file', async () => {
    await fs.writeFile(testFile, 'test content')
    await expect(assertNotSymlink(testFile)).resolves.toBeUndefined()
  })

  it('throws SymlinkError for symlinks', async () => {
    // Create a file and a symlink to it
    await fs.writeFile(testFile, 'test content')
    await fs.symlink(testFile, testSymlink)

    await expect(assertNotSymlink(testSymlink)).rejects.toThrow(SymlinkError)
    await expect(assertNotSymlink(testSymlink)).rejects.toThrow(/symlink/)
  })

  it('SymlinkError includes the file path', async () => {
    await fs.writeFile(testFile, 'test content')
    await fs.symlink(testFile, testSymlink)

    try {
      await assertNotSymlink(testSymlink)
      expect.fail('Expected SymlinkError to be thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(SymlinkError)
      expect((error as SymlinkError).filePath).toBe(testSymlink)
    }
  })
})
