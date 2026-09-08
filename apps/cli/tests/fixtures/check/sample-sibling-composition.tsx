import { Document, Table } from '@paradoc/components'
import type { DocumentData } from '@paradoc/react'
import type { Form } from '@paradoc/types'

/**
 * Carries no `sample` export of its own: the sibling `.sample.ts` file
 * supplies one. Its column names a field the line item does not declare, so
 * the check reports an unresolved path only when a row actually exists to
 * check it against — which happens only when the sibling sample's data was
 * discovered and used, proving the discovery route works rather than merely
 * running the check with no data at all.
 */
export default function SampleSiblingComposition({ artifact, data }: { artifact: Form; data: DocumentData }) {
  return (
    <Document artifact={artifact} data={data}>
      <Table path="lineItems" columns={[{ field: 'doesNotExist' }]} />
    </Document>
  )
}
