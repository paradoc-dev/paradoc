import type {
  SignatureCapturedValue,
  SignaturePlaceholderValue,
} from '@paradoc/types'
import { createSignatureDirectives } from '../text/signatures'
import type { SigningDirective } from '../text/template'

export interface DocxSignatureOptions {
  placeholder?: {
    signature?: SignaturePlaceholderValue
    initials?: SignaturePlaceholderValue
    signatureDate?: SignaturePlaceholderValue
    capacity?: SignaturePlaceholderValue
    printedName?: SignaturePlaceholderValue
  }
  captured?: {
    signature?: SignatureCapturedValue
    initials?: SignatureCapturedValue
    signatureDate?: SignatureCapturedValue
    capacity?: SignatureCapturedValue
    printedName?: SignatureCapturedValue
  }
}

const docxDefaults = {
  signature: '_____________________________',
  initials: '______',
  date: '__________',
  capacity: '________________',
  printedName: '_______________________',
  capturedSignature: '[Signed]',
  capturedInitials: '[Initialed]',
}

/** The signing directives a DOCX template can write, with underline placeholders. */
export function createDocxSignatureDirectives(options: DocxSignatureOptions = {}): Record<string, SigningDirective> {
  return createSignatureDirectives(options, docxDefaults)
}
