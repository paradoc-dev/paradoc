/**
 * Hash Utilities
 *
 * Uses local-fs for all filesystem operations.
 * Only node:crypto is used directly for in-memory hash computation.
 */

import { createHash } from 'node:crypto'
import { LocalFileSystem } from './local-fs.js'

/**
 * Computes the SHA256 hash of content (string or buffer)
 * @param content - Content to hash
 * @returns Hex-encoded SHA256 hash
 */
export function computeHashFromContent(content: string | Uint8Array): string {
  const hash = createHash('sha256')
  hash.update(content)
  return hash.digest('hex')
}

function parseChecksum(checksum: string): { algorithm: 'sha256'; hash: string } {
  const parts = checksum.split(':')
  if (parts.length !== 2) {
    throw new Error(`Invalid checksum format: ${checksum}. Expected "sha256:hash"`)
  }
  const [algorithm, hash] = parts
  if (algorithm !== 'sha256') {
    throw new Error(`Unsupported hash algorithm: ${algorithm}. Only sha256 is supported`)
  }
  return { algorithm, hash: hash ?? '' }
}

/**
 * Verifies content matches the expected checksum
 * @param content - Content to verify
 * @param expectedChecksum - Expected checksum in format "sha256:hash"
 * @returns Object with valid flag and details
 */
export function verifyChecksum(
  content: string | Buffer,
  expectedChecksum: string
): { valid: boolean; expected: string; actual: string; algorithm: string } {
  const { algorithm, hash: expectedHash } = parseChecksum(expectedChecksum)

  const actualHash = computeHashFromContent(content)

  return {
    valid: actualHash === expectedHash,
    expected: expectedHash,
    actual: actualHash,
    algorithm,
  }
}

/**
 * Computes the SHA256 hash of a file (text or binary)
 * Uses streaming to handle large files without loading into memory
 * @param filePath - Path to the file to hash
 * @returns Promise that resolves to the hex-encoded SHA256 hash
 */
export async function computeHash(filePath: string): Promise<string> {
  const storage = new LocalFileSystem()
  return storage.computeFileHash(filePath, 'sha256')
}

/**
 * Verifies a file's hash matches the expected checksum
 * @param filePath - Path to the file to verify
 * @param expectedChecksum - Expected checksum in format "sha256:hash"
 * @returns Promise that resolves to true if hash matches, false otherwise
 */
export async function verifyHashFromFile(
  filePath: string,
  expectedChecksum: string
): Promise<boolean> {
  const { hash: expectedHash } = parseChecksum(expectedChecksum)

  const storage = new LocalFileSystem()
  const actualHash = await storage.computeFileHash(filePath, 'sha256')

  return actualHash === expectedHash
}
