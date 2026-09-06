import { Document, Field } from '@paradoc/react'
import type { DocumentData } from '@paradoc/react'
import type { Form } from '@paradoc/types'

/** `grid-cols-3` is not in takumi's verified class vocabulary: no grid family is. */
export default function UnsupportedClassComposition({ artifact, data }: { artifact: Form; data: DocumentData }) {
  return (
    <Document artifact={artifact} data={data}>
      <Field path="name" className="grid-cols-3" />
    </Document>
  )
}

export const sample: DocumentData = { fields: { name: 'Ada Lovelace' }, parties: {} }
