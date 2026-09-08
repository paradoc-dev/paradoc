/**
 * Minimal resolver interface for reading content from storage.
 *
 * Implementations can back this with:
 *  - In-memory map (@paradoc/resolvers/memory)
 *  - Local filesystem (@paradoc/resolvers/fs)
 *  - Object storage (S3/R2/etc.)
 *  - HTTP fetch
 */
export interface Resolver {
  /**
   * Read raw bytes from a logical path interpreted by this resolver.
   */
  read(path: string): Promise<Uint8Array>
}
