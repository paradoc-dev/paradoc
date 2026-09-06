import { Document, Field } from '@paradoc/react'
import type { DocumentData } from '@paradoc/react'
import type { Form } from '@paradoc/types'

/** `doesNotExist` is not a field the artifact declares. */
export default function UnresolvedPathComposition({ artifact, data }: { artifact: Form; data: DocumentData }) {
  return (
    <Document artifact={artifact} data={data}>
      <Field path="doesNotExist" />
    </Document>
  )
}

export const sample: DocumentData = { fields: { name: 'Ada Lovelace' }, parties: {} }
