import type { SerializerRegistry } from '@paradoc/types'

class SerializedFieldValue {
  constructor(
    private readonly value: unknown,
    private readonly stringify: (value: unknown) => string,
  ) {
    if (value !== null && typeof value === 'object') Object.assign(this, value)
  }

  toString(): string {
    return this.stringify(this.value)
  }
}

export function createSerializedFieldValue(
  value: unknown,
  fieldType: string,
  serializers: SerializerRegistry,
): SerializedFieldValue | unknown {
  if (value === null || value === undefined) return value
  const serializer = (() => {
    switch (fieldType) {
      case 'money': return serializers.money
      case 'address': return serializers.address
      case 'phone': return serializers.phone
      case 'person': return serializers.person
      case 'organization': return serializers.organization
      case 'party': return serializers.party
      case 'coordinate': return serializers.coordinate
      case 'bbox': return serializers.bbox
      case 'duration': return serializers.duration
      case 'identification': return serializers.identification
      default: return undefined
    }
  })() as { stringify(value: unknown): string } | undefined
  return serializer ? new SerializedFieldValue(value, (raw) => serializer.stringify(raw)) : value
}
