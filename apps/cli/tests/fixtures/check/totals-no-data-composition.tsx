import { Document, Totals } from '@paradoc/components'
import type { DocumentData } from '@paradoc/react'
import type { Form } from '@paradoc/types'

/**
 * No `sample` export and no sibling `.sample.ts` — the check runs with
 * empty fields and parties. `total` therefore evaluates to
 * `{ amount: null, currency: null }`, a non-blank value the money
 * serializer rejects; the schema check must still finish and report clean.
 */
export default function TotalsNoDataComposition({ artifact, data }: { artifact: Form; data: DocumentData }) {
  return (
    <Document artifact={artifact} data={data}>
      <Totals rows={[{ def: 'total' }]} />
    </Document>
  )
}
