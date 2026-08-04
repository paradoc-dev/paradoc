import type { SignatureCapturedValue, SignaturePlaceholderValue } from '@paradoc/types'

export interface PdfSignatureOptions {
  placeholder?: {
    signature?: SignaturePlaceholderValue
    initials?: SignaturePlaceholderValue
    capacity?: SignaturePlaceholderValue
    printedName?: SignaturePlaceholderValue
  }
  captured?: {
    signature?: SignatureCapturedValue
    initials?: SignatureCapturedValue
    capacity?: SignatureCapturedValue
    printedName?: SignatureCapturedValue
  }
}

export function resolvePdfSignatureOptions(options: PdfSignatureOptions = {}): PdfSignatureOptions {
  return {
    placeholder: {
      signature: options.placeholder?.signature ?? '_____________________________',
      initials: options.placeholder?.initials ?? '______',
      capacity: options.placeholder?.capacity ?? '________________',
      printedName: options.placeholder?.printedName ?? '_______________________',
    },
    captured: {
      signature: options.captured?.signature ?? '[Signed]',
      initials: options.captured?.initials ?? '[Initialed]',
      capacity: options.captured?.capacity ?? '________________',
      printedName: options.captured?.printedName ?? '_______________________',
    },
  }
}
