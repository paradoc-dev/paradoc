/** Encode text for the native PDF renderer's WinAnsi standard font. */
export function winAnsiText(value: string): string {
  const extensions = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ'
  return [...value].map((char) => {
    const code = char.codePointAt(0)!
    if (char === '\n' || char === '\r') return ' '
    if (code >= 0x20 && code <= 0x7e) return /[\\()]/.test(char) ? `\\${char}` : char
    const extension = extensions.indexOf(char)
    const byte = code >= 0xa0 && code <= 0xff ? code : extension >= 0 && code > 0xff ? extension + 0x80 : undefined
    if (byte === undefined) throw new Error(`Native PDF font cannot render U+${code.toString(16).toUpperCase()}; use a renderer with the required font and script support`)
    return `\\${byte.toString(8).padStart(3, '0')}`
  }).join('')
}
