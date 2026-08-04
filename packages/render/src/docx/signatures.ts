import type {
  SignatureCapturedValue,
  SignaturePlaceholderValue,
} from '@paradoc/types'
import { createSignatureHelpers } from '../text/signatures'
import type { TemplateHelper } from '../text/template'

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

export function createDocxTemplateHelpers(options: DocxSignatureOptions = {}): Record<string, TemplateHelper> {
  const helpers = createSignatureHelpers(options, docxDefaults)
  return Object.fromEntries(Object.entries(helpers).map(([name, helper]) => [
    name,
    (_context: unknown, root: Record<string, unknown>, args: unknown[]) => helper(args[0], root, args.slice(1)),
  ]))
}

export function createDocxSignatureHelpers(
  rootData: Record<string, unknown>,
  options: DocxSignatureOptions = {},
) {
  const helpers = createSignatureHelpers(options, docxDefaults)
  return {
    signature: (partyOrSignatory: unknown, locationId: string) => helpers.signature!(partyOrSignatory, rootData, [locationId]),
    initials: (partyOrSignatory: unknown, locationId: string) => helpers.initials!(partyOrSignatory, rootData, [locationId]),
    signatureDate: (partyOrSignatory: unknown, locationId: string) => helpers.signatureDate!(partyOrSignatory, rootData, [locationId]),
    capacity: (partyOrSignatory: unknown, locationId: string) => helpers.capacity!(partyOrSignatory, rootData, [locationId]),
    printedName: (partyOrSignatory: unknown, locationId: string) => helpers.printedName!(partyOrSignatory, rootData, [locationId]),
  }
}
