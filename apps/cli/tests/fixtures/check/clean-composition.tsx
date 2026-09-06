import { Document, Field } from '@paradoc/react'
import type { DocumentData } from '@paradoc/react'
import type { Form } from '@paradoc/types'

export default function CleanComposition({ artifact, data }: { artifact: Form; data: DocumentData }) {
  return (
    <Document artifact={artifact} data={data}>
      <Field path="name" className="flex flex-col gap-1" />
    </Document>
  )
}

/** Sample data `para check` discovers automatically. */
export const sample: DocumentData = { fields: { name: 'Ada Lovelace' }, parties: {} }
