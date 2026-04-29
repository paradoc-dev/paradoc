/**
 * Minimal resolver interface for reading content from storage.
 *
 * Implementations can back this with:
 *  - In-memory map (@paradoc/core createMemoryResolver)
 *  - Local filesystem (@paradoc/resolvers)
 *  - Object storage (S3/R2/etc.)
 *  - HTTP fetch
 */
export interface Resolver {
  /**
   * Read raw bytes from a path.
   * The path is relative to the resolver's root (e.g., repo root).
   */
  read(path: string): Promise<Uint8Array>
}
