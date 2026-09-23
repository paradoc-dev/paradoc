import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * The user's home directory. Every CLI path under the home resolves through
 * this function, so a HOME (or USERPROFILE on Windows) override applies everywhere.
 */
export function userHomeDir(): string {
  return homedir()
}

/**
 * A path inside the CLI's global directory, `~/.paradoc`.
 */
export function paradocHomePath(...segments: string[]): string {
  return join(userHomeDir(), '.paradoc', ...segments)
}
