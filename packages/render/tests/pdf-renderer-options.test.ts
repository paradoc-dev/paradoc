import { describe, expect, it } from 'vitest'
import { renderLayer } from '../src/index'
import * as pdf from '../src/pdf'
import { renderPdf } from '../src/pdf'
import { pagePdf } from './pdf-fixtures'

const form = { fields: {} } as never

// PDF rendering never drew signature text, so it takes no signature options.
// The type checks below fail `pnpm check-types` if the options come back.
describe('PDF renderer options', () => {
  it('pdfRenderer takes its supported options and renders', async () => {
    const renderer = pdf.pdfRenderer({ font: undefined })
    const output = await renderer.render({
      template: { type: 'pdf', mimeType: 'application/pdf', content: pagePdf([[300, 300]]) },
      form,
      data: { fields: {} },
    } as never)
    expect((await pdf.inspectPdf(output)).pageCount).toBe(1)
  })

  it('pdfRenderer rejects signatureOptions', () => {
    // @ts-expect-error signatureOptions is not a PDF renderer option
    expect(pdf.pdfRenderer({ signatureOptions: {} }).id).toBe('pdf')
  })

  it('renderPdf rejects signatureOptions', async () => {
    const output = await renderPdf({
      template: pagePdf([[300, 300]]),
      data: {},
      // @ts-expect-error signatureOptions is not a renderPdf option
      signatureOptions: {},
    })
    expect((await pdf.inspectPdf(output)).pageCount).toBe(1)
  })

  it('renderLayer rejects pdfSignatureOptions', () => {
    // @ts-expect-error pdfSignatureOptions is not a renderLayer option
    expect(renderLayer({ pdfSignatureOptions: {} }).id).toBe('render-layer')
  })

  it('@paradoc/render/pdf exports no signature options resolver', () => {
    expect('resolvePdfSignatureOptions' in pdf).toBe(false)
  })
})
