/**
 * CLI constants
 * Values are injected at build time via tsup's define option
 */

declare const __VERSION__: string | undefined

/** CLI version from package.json, injected at build time */
export const VERSION: string =
  typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'dev'

/**
 * Brand color using ANSI 256 color code
 * #F53D00 (RGB: 245, 61, 0) ≈ ANSI 256 color 202 (orange-red)
 */
export const brandColor = (text: string): string => `\x1b[38;5;202m${text}\x1b[0m`
export const brandColorBold = (text: string): string => `\x1b[1m\x1b[38;5;202m${text}\x1b[0m`
