/**
 * Coordinate overlays: the page guard, JPEG embedding, and the PNG format guard.
 */

import { zlibSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { renderPdf } from '../src/pdf'
import { pagePdf } from './pdf-fixtures'

const latin1 = (bytes: Uint8Array) => Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')

/** A baseline JPEG header: SOI, then a SOF0 segment declaring the size and components. */
function jpeg(width: number, height: number, components = 3): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, components,
    0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    0xff, 0xd9,
  ])
}

function chunk(type: string, data: Uint8Array): number[] {
  const length = data.length
  return [length >>> 24, (length >>> 16) & 0xff, (length >>> 8) & 0xff, length & 0xff, ...Array.from(type, (char) => char.charCodeAt(0)), ...data, 0, 0, 0, 0]
}

/** A one-pixel grayscale PNG with the given bit depth. */
function png(bitDepth: number): Uint8Array {
  const header = new Uint8Array([0, 0, 0, 1, 0, 0, 0, 1, bitDepth, 0, 0, 0, 0])
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk('IHDR', header),
    ...chunk('IDAT', zlibSync(new Uint8Array(bitDepth === 16 ? [0, 0, 0] : [0, 128]))),
    ...chunk('IEND', new Uint8Array()),
  ])
}

const overlay = { page: 1, x: 10, y: 10, width: 30, height: 20 }

describe('PDF overlays', () => {
  it('embeds a JPEG overlay as a DCT image with the size its header declares', async () => {
    const pdf = await renderPdf({ template: pagePdf([[300, 300]]), data: {}, overlays: [{ ...overlay, image: jpeg(3, 2), mediaType: 'image/jpeg' }] })
    const text = latin1(pdf)
    expect(text).toMatch(/\/Filter\s*\/DCTDecode/)
    expect(text).toMatch(/\/Width\s+3\b/)
    expect(text).toMatch(/\/Height\s+2\b/)
    expect(text).toContain('/PdrI0 Do')
  })

  it('refuses bytes that are not a JPEG', async () => {
    await expect(renderPdf({ template: pagePdf([[300, 300]]), data: {}, overlays: [{ ...overlay, image: new Uint8Array([1, 2, 3]), mediaType: 'image/jpeg' }] }))
      .rejects.toThrow('Invalid JPEG image')
  })

  it('embeds an 8-bit PNG overlay', async () => {
    const pdf = await renderPdf({ template: pagePdf([[300, 300]]), data: {}, overlays: [{ ...overlay, image: png(8), mediaType: 'image/png' }] })
    expect(latin1(pdf)).toContain('/PdrI0 Do')
  })

  it('refuses a PNG format it cannot embed', async () => {
    await expect(renderPdf({ template: pagePdf([[300, 300]]), data: {}, overlays: [{ ...overlay, image: png(16), mediaType: 'image/png' }] }))
      .rejects.toThrow(/PNG overlays require non-interlaced 8-bit/)
  })

  it('refuses an overlay on a page the document does not have', async () => {
    await expect(renderPdf({ template: pagePdf([[300, 300]]), data: {}, overlays: [{ page: 2, x: 0, y: 0, text: 'late' }] }))
      .rejects.toThrow("PDF overlay page 2 is outside the document's 1 pages")
    await expect(renderPdf({ template: pagePdf([[300, 300]]), data: {}, overlays: [{ page: 1.5, x: 0, y: 0, text: 'half' }] }))
      .rejects.toThrow(/outside the document/)
  })
})
