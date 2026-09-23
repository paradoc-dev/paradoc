const EXTENSIONS = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ'

/** WinAnsi byte codes for text drawn in the native renderer's standard font. */
export function winAnsiCodes(value: string): number[] {
  return [...value].map((char) => {
    const code = char.codePointAt(0)!
    if (char === '\n' || char === '\r') return 0x20
    if (code >= 0x20 && code <= 0x7e) return code
    const extension = EXTENSIONS.indexOf(char)
    const byte = code >= 0xa0 && code <= 0xff ? code : extension >= 0 && code > 0xff ? extension + 0x80 : undefined
    if (byte === undefined) throw new Error(`Native PDF font cannot render U+${code.toString(16).toUpperCase()}; use a renderer with the required font and script support`)
    return byte
  })
}

/** Encode text as the body of a PDF literal string in the WinAnsi standard font. */
export function winAnsiText(value: string): string {
  return winAnsiCodes(value).map((code) => {
    if (code >= 0x20 && code <= 0x7e) {
      const char = String.fromCharCode(code)
      return /[\\()]/.test(char) ? `\\${char}` : char
    }
    return `\\${code.toString(8).padStart(3, '0')}`
  }).join('')
}
