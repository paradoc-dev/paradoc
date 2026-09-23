import { winAnsiCodes } from './win-ansi'

/**
 * Helvetica advance widths, in 1000ths of the font size, for WinAnsi codes
 * 32–255 (from the standard Adobe font metrics). Codes WinAnsi leaves
 * undefined carry 0.
 */
const HELVETICA_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 0,
  556, 0, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0,
  0, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 0, 500, 500,
  278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333,
  400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611,
  667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278,
  722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
  556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556, 500,
]

/** Metrics the field layout needs from the font that draws a value. */
export interface FontMetrics {
  /** Height above the baseline, in 1000ths of the font size. */
  ascent: number
  /** Depth below the baseline (negative), in 1000ths of the font size. */
  descent: number
  /** Advance width of `text` in 1000ths of the font size. */
  width(text: string): number
}

/** Standard Helvetica with WinAnsi encoding. */
export const helvetica: FontMetrics = {
  ascent: 718,
  descent: -207,
  width(text: string): number {
    return winAnsiCodes(text).reduce((total, code) => total + (HELVETICA_WIDTHS[code - 32] ?? 0), 0)
  },
}
