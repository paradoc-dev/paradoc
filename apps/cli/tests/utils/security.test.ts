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
  it('leaves structural validation to core', () => {
    const result = validateDownloadedArtifact({ kind: 'invalid' })
    expect(result).toEqual({ valid: true, errors: [], warnings: [] })
  })

  it('warns when the downloaded name differs from the requested name', () => {
    const result = validateDownloadedArtifact({ name: 'actual-name' }, 'expected-name')
    expect(result.warnings).toContain('Artifact name "actual-name" does not match expected name "expected-name"')
  })

  it('warns about control characters in display fields', () => {
    const result = validateDownloadedArtifact({ title: 'Test\x00Title', description: '\x1B[31mRed\x1B[0m' })
    expect(result.warnings).toHaveLength(2)
    expect(result.warnings.every((warning) => warning.includes('control characters'))).toBe(true)
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
