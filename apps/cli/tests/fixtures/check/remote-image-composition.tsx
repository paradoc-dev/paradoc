import { Document, Field, KeepTogether } from '@paradoc/components'
import type { DocumentData } from '@paradoc/react'
import type { Form } from '@paradoc/types'

/** An image whose `src` is not a `data:` URI: a render would need bytes for it. */
export default function RemoteImageComposition({ artifact, data }: { artifact: Form; data: DocumentData }) {
  return (
    <Document artifact={artifact} data={data}>
      <KeepTogether as="img" keepId="logo" src="https://example.com/logo.png" alt="" />
      <Field path="name" className="flex flex-col gap-1" />
    </Document>
  )
}

export const sample: DocumentData = { fields: { name: 'Ada Lovelace' }, parties: {} }
