import type { Form, FormField, FormAnnex, FormParty, Person, Organization, Attachment } from '@paradoc/types'

type EnumOptionValue<T> = T extends { value: infer V } ? V : never
type RuntimeEnumOption = { value: string | number }

// JSON Schema type for compiled output
export type JsonSchema = {
  type?: string
  properties?: Record<string, JsonSchema>
  required?: string[]
  additionalProperties?: boolean
  items?: JsonSchema
  anyOf?: JsonSchema[]
  const?: unknown
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  format?: string
  description?: string
  default?: unknown
  [key: string]: unknown
}

// ============================================================================
// TYPE MAPPERS - Convert field definitions to runtime data types
// ============================================================================

/**
 * Maps a single field definition to its runtime data type
 */
export type FieldToDataType<F> = F extends { type: 'text' }
  ? string
  : F extends { type: 'email' }
    ? string
    : F extends { type: 'uri' }
      ? string
      : F extends { type: 'uuid' }
        ? string
        : F extends { type: 'boolean' }
          ? boolean
          : F extends { type: 'number' }
            ? number
            : F extends { type: 'coordinate' }
              ? { lat: number; lon: number }
              : F extends { type: 'bbox' }
                ? {
                    southWest: { lat: number; lon: number }
                    northEast: { lat: number; lon: number }
                  }
                : F extends { type: 'money' }
                  ? { amount: number; currency: string }
                  : F extends { type: 'address' }
                    ? {
                        line1: string
                        line2?: string
                        locality: string
                        region: string
                        postalCode: string
                        country: string
                      }
                    : F extends { type: 'phone' }
                      ? { number: string; type?: string; extension?: string }
                      : F extends { type: 'duration' }
                        ? string
                        : F extends { type: 'enum'; enum: infer E }
                          ? E extends readonly (infer U)[]
                            ? EnumOptionValue<U>
                            : never
                          // New field types:
                          : F extends { type: 'date' }
                            ? string
                            : F extends { type: 'datetime' }
                              ? string
                              : F extends { type: 'time' }
                                ? string
                                : F extends { type: 'person' }
                                  ? {
                                      name: string
                                      title?: string
                                      firstName?: string
                                      middleName?: string
                                      lastName?: string
                                      suffix?: string
                                    }
                                  : F extends { type: 'organization' }
                                    ? {
                                        name: string
                                        legalName?: string
                                        domicile?: string
                                        entityType?: string
                                        entityId?: string
                                        taxId?: string
                                      }
                                    : F extends { type: 'identification' }
                                      ? {
                                          type: string
                                          number: string
                                          issuer?: string
                                          issueDate?: string
                                          expiryDate?: string
                                        }
                                      : F extends { type: 'multiselect'; enum: infer E }
                                        ? E extends readonly (infer U)[]
                                          ? EnumOptionValue<U>[]
                                          : (string | number)[]
                                        : F extends { type: 'percentage' }
                                          ? number
                                          : F extends { type: 'rating' }
                                            ? number
                                            : F extends { type: 'fieldset'; fields: infer Fields }
                                              ? Fields extends Record<string, FormField>
                                                ? FieldsToDataType<Fields>
                                                : never
                                              : unknown

/**
 * Helper type to check if a field should be treated as required.
 *
 * Strategy:
 * 1. Object pattern with `required: true` → required (literal type preserved)
 * 2. Builder pattern with `.required()` → optional (conservative, type can't be inferred)
 * 3. Object pattern with `required: false` or no `required` → optional
 * 4. Expression strings `required: 'expr'` → optional (runtime-determined)
 *
 * Note: For full type safety with builders, use `InferFormPayload` explicitly:
 * ```ts
 * type MyData = InferFormPayload<typeof myForm>
 * const data: MyData = { fields: { ... } }
 * myForm.fill(data)
 * ```
 */
type IsFieldRequired<F extends FormField> =
  // Explicit false → optional
  F extends { required: false } ? false :
  // Explicit true (literal) → required
  F extends { required: true } ? true :
  // String expression → optional (runtime-determined)
  F extends { required: string } ? false :
  // Default → optional (conservative for builder patterns)
  false

/**
 * Maps a record of field definitions to their runtime data types
 * Handles required vs optional fields:
 * - Fields with `required: true` or builder fields with `.required()` become required properties
 * - Fields with `required: false`, expressions, or no `required` become optional properties
 * Uses -readonly to strip readonly modifiers from as const
 */
export type FieldsToDataType<Fields extends Record<string, FormField>> = {
  // Required fields - must be present
  -readonly [K in keyof Fields as IsFieldRequired<Fields[K]> extends true
    ? K
    : never]: FieldToDataType<Fields[K]>
} & {
  // Optional fields - can be omitted entirely
  -readonly [K in keyof Fields as IsFieldRequired<Fields[K]> extends true
    ? never
    : K]?: FieldToDataType<Fields[K]>
}

/**
 * Deep expand utility for nested objects - used for better IDE display
 */
type ExpandDeep<T> = T extends object
  ? T extends infer O
    ? { [K in keyof O]: ExpandDeep<O[K]> }
    : never
  : T

/**
 * Helper to extract the form schema from either a raw Form or FormInstance
 */
type ExtractFormSchema<T> = T extends { schema: infer S } ? S : T

// ============================================================================
// PARTY TYPE MAPPERS - Convert party definitions to runtime data types
// ============================================================================

/**
 * Runtime party types include an `id` field for signature tracking.
 * The id is required at runtime to associate signatures with specific parties.
 */
type RuntimePerson = Person & { id: string }
type RuntimeOrganization = Organization & { id: string }

/**
 * Maps a single party definition to its runtime data type based on partyType.
 * Runtime parties always include an `id` field for signature tracking.
 *
 * Party data accepts both single and array forms because:
 * 1. Builder patterns don't preserve literal `multiple: true` - TypeScript sees `boolean`
 * 2. FormParty type has `multiple?: boolean` which makes runtime checking necessary
 *
 * The runtime fills in single or array based on the actual party definition.
 */
type PartyToDataType<P extends FormParty> = P extends { partyType: 'person' }
  ? RuntimePerson | RuntimePerson[]
  : P extends { partyType: 'organization' }
    ? RuntimeOrganization | RuntimeOrganization[]
    : (RuntimePerson | RuntimeOrganization) | (RuntimePerson | RuntimeOrganization)[]

/**
 * Maps a record of party definitions to their runtime data types
 * Handles required vs optional parties based on the required property
 */
type PartiesToDataType<Parties extends Record<string, FormParty>> = {
  // Required parties - must be present
  -readonly [K in keyof Parties as Parties[K] extends { required: true }
    ? K
    : never]: PartyToDataType<Parties[K]>
} & {
  // Optional parties - can be omitted
  -readonly [K in keyof Parties as Parties[K] extends { required: true }
    ? never
    : K]?: PartyToDataType<Parties[K]>
}

/**
 * Maps a record of annex definitions to their runtime data types (Attachment)
 * Handles required vs optional annexes
 */
type AnnexesToDataType<Annexes extends Record<string, FormAnnex>> = {
  // Required annexes - must be present
  -readonly [K in keyof Annexes as Annexes[K] extends { required: true }
    ? K
    : never]: Attachment
} & {
  // Optional annexes - can be omitted
  -readonly [K in keyof Annexes as Annexes[K] extends { required: true }
    ? never
    : K]?: Attachment
}

/**
 * Infers the complete data payload type from a form definition
 * Includes fields, parties, and annexes based on what the form defines.
 * Strips readonly to allow mutation of data payloads.
 *
 * Note: IDE hover may show the unexpanded type alias. Use InferFormPayload
 * for a fully expanded type that displays cleanly in IDE hovers.
 *
 * This type works with both raw Form objects and FormInstance wrappers.
 */
type InferFormDataInternal<FormSchema> = FormSchema extends { fields: infer F }
  ? F extends Record<string, FormField>
    ? // Base with fields
      { fields: FieldsToDataType<F> } &
        // Add parties if defined (use NonNullable to handle optional properties)
        (FormSchema extends { parties: infer P }
          ? NonNullable<P> extends Record<string, FormParty>
            ? { parties?: PartiesToDataType<NonNullable<P>> }
            : unknown
          : unknown) &
        // Add annexes if defined (use NonNullable to handle optional properties)
        (FormSchema extends { annexes: infer A }
          ? NonNullable<A> extends Record<string, FormAnnex>
            ? { annexes?: AnnexesToDataType<NonNullable<A>> }
            : unknown
          : unknown)
    : { fields: Record<string, unknown> }
  : { fields: Record<string, unknown> }

export type InferFormData<Form> = InferFormDataInternal<ExtractFormSchema<Form>>

/**
 * Infers the complete data payload type from a form definition with full type expansion.
 * This version expands the type so IDE hovers show the actual structure like:
 *   { fields: { age: number; name: string | undefined } }
 * instead of:
 *   { fields: FieldsToDataType<...> }
 *
 * @example
 * ```typescript
 * const myForm = para.form({
 *   kind: 'form',
 *   name: 'example',
 *   version: '1.0.0',
 *   title: 'Example',
 *   fields: {
 *     age: { type: 'number', label: 'Age', required: true },
 *     name: { type: 'text', label: 'Name' },
 *   },
 * })
 *
 * type Payload = InferFormPayload<typeof myForm>
 * // Hovering shows: { fields: { age: number; name: string | undefined } }
 * ```
 */
export type InferFormPayload<Form> = ExpandDeep<InferFormData<Form>>

/**
 * Compile a Form into a JSON Schema for validating data payloads
 *
 * Takes a form artifact and returns a schema representing the expected data shape:
 * { fields: { fieldId: value, ... }, annexes: { annexId: value, ... } }
 *
 * @param form - The form artifact definition
 * @returns A JSON Schema for validating form data
 *
 * @example
 * ```typescript
 * import { compile } from './compile';
 *
 * const schema = compile(myForm);
 *
 * const data = {
 *   fields: { firstName: 'John', lastName: 'Doe' },
 *   annexes: {}
 * };
 * ```
 */
export function compile(form: Form): JsonSchema {
  const properties: Record<string, JsonSchema> = {}
  const required: string[] = ['fields']

  // Compile fields (always present)
  properties.fields = compileFields(form.fields || {})

  // Compile parties if defined
  if (form.parties && Object.keys(form.parties).length > 0) {
    const partiesSchema = compileParties(form.parties)
    properties.parties = partiesSchema

    // Check if any parties are required (with boolean true, not expression)
    const hasRequiredParties = Object.values(form.parties).some((party) => party.required === true)
    if (hasRequiredParties) {
      required.push('parties')
    }
  } else {
    // No parties defined - accept optional empty parties property
    properties.parties = { type: 'object', additionalProperties: false }
  }

  // Compile annexes if defined
  if (form.annexes && Object.keys(form.annexes).length > 0) {
    const annexesSchema = compileAnnexes(form.annexes)
    properties.annexes = annexesSchema

    // Check if any annexes are required
    const hasRequiredAnnexes = Object.values(form.annexes).some((annex) => annex.required === true)
    if (hasRequiredAnnexes) {
      required.push('annexes')
    }
  } else {
    // No annexes defined - accept optional empty annexes property
    properties.annexes = { type: 'object', additionalProperties: false }
  }

  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  }
}

/**
 * Convert form field definitions into a data validation schema
 */
function compileFields(fields: Record<string, FormField>): JsonSchema {
  const properties: Record<string, JsonSchema> = {}
  const required: string[] = []

  for (const [fieldId, fieldDef] of Object.entries(fields)) {
    properties[fieldId] = compileField(fieldDef)

    if (fieldDef.required === true) {
      required.push(fieldId)
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 && { required }),
    additionalProperties: false,
  }
}

/**
 * Convert a single field definition to its data type schema
 */
function compileField(field: FormField): JsonSchema {
  switch (field.type) {
    case 'text':
    case 'email':
    case 'uri':
    case 'uuid': {
      const stringSchema: JsonSchema = {
        type: 'string',
      }
      if ('minLength' in field && typeof field.minLength === 'number') {
        stringSchema.minLength = field.minLength
      }
      if ('maxLength' in field && typeof field.maxLength === 'number') {
        stringSchema.maxLength = field.maxLength
      }
      if ('pattern' in field && typeof field.pattern === 'string') {
        stringSchema.pattern = field.pattern
      }
      if ('default' in field && field.default !== undefined) {
        stringSchema.default = field.default
      }
      return stringSchema
    }

    case 'boolean':
      return {
        type: 'boolean',
        ...('default' in field && field.default !== undefined && { default: field.default }),
      }

    case 'number': {
      const numberSchema: JsonSchema = {
        type: 'number',
      }
      if ('min' in field && typeof field.min === 'number') {
        numberSchema.minimum = field.min
      }
      if ('max' in field && typeof field.max === 'number') {
        numberSchema.maximum = field.max
      }
      if ('default' in field && field.default !== undefined) {
        numberSchema.default = field.default
      }
      return numberSchema
    }

    case 'coordinate':
      return {
        type: 'object',
        properties: {
          lat: { type: 'number', minimum: -90, maximum: 90 },
          lon: { type: 'number', minimum: -180, maximum: 180 },
        },
        required: ['lat', 'lon'],
        additionalProperties: false,
        ...('default' in field && field.default !== undefined && { default: field.default }),
      }

    case 'bbox':
      return {
        type: 'object',
        properties: {
          southWest: {
            type: 'object',
            properties: {
              lat: { type: 'number', minimum: -90, maximum: 90 },
              lon: { type: 'number', minimum: -180, maximum: 180 },
            },
            required: ['lat', 'lon'],
            additionalProperties: false,
          },
          northEast: {
            type: 'object',
            properties: {
              lat: { type: 'number', minimum: -90, maximum: 90 },
              lon: { type: 'number', minimum: -180, maximum: 180 },
            },
            required: ['lat', 'lon'],
            additionalProperties: false,
          },
        },
        required: ['southWest', 'northEast'],
        additionalProperties: false,
        ...('default' in field && field.default !== undefined && { default: field.default }),
      }

    case 'money':
      return {
        type: 'object',
        properties: {
          amount: (() => {
            const amountSchema: JsonSchema = { type: 'number' }
            if ('min' in field && typeof field.min === 'number') {
              amountSchema.minimum = field.min
            }
            if ('max' in field && typeof field.max === 'number') {
              amountSchema.maximum = field.max
            }
            return amountSchema
          })(),
          currency: { type: 'string', minLength: 3, maxLength: 3 },
        },
        required: ['amount', 'currency'],
        additionalProperties: false,
        ...('default' in field && field.default !== undefined && { default: field.default }),
      }

    case 'address':
      return {
        type: 'object',
        properties: {
          line1: { type: 'string' },
          line2: { type: 'string' },
          locality: { type: 'string' },
          region: { type: 'string' },
          postalCode: { type: 'string' },
          country: { type: 'string' },
        },
        required: ['line1', 'locality', 'region', 'postalCode', 'country'],
        additionalProperties: false,
        ...('default' in field && field.default !== undefined && { default: field.default }),
      }

    case 'phone':
      return {
        type: 'object',
        properties: {
          number: { type: 'string', pattern: '^\\+[1-9]\\d{1,14}$' },
          type: {
            anyOf: [{ const: 'mobile' }, { const: 'work' }, { const: 'home' }],
          },
        },
        required: ['number'],
        additionalProperties: false,
        ...('default' in field && field.default !== undefined && { default: field.default }),
      }

    case 'duration':
      return {
        type: 'string',
        pattern: '^P(?:\\d+Y)?(?:\\d+M)?(?:\\d+D)?(?:T(?:\\d+H)?(?:\\d+M)?(?:\\d+(?:\\.\\d+)?S)?)?$',
        ...('default' in field && field.default !== undefined && { default: field.default }),
      }

    case 'enum':
      if ('enum' in field && Array.isArray(field.enum) && field.enum.length > 0) {
        const anyOf = (field.enum as RuntimeEnumOption[]).map((option) => ({ const: option.value }))
        return {
          anyOf,
          ...('default' in field && field.default !== undefined && { default: field.default }),
        }
      }
      return { type: 'string' }

    // New field types: Temporal
    case 'date':
      return {
        type: 'string',
        format: 'date',
        ...('default' in field && field.default !== undefined && { default: field.default }),
      }

    case 'datetime':
      return {
        type: 'string',
        format: 'date-time',
        ...('default' in field && field.default !== undefined && { default: field.default }),
      }

    case 'time':
      return {
        type: 'string',
        pattern: '^([01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d$',
        ...('default' in field && field.default !== undefined && { default: field.default }),
      }

    // New field types: Entity
    case 'person':
      return {
        type: 'object',
        properties: {
          name: { type: 'string' },
          title: { type: 'string' },
          firstName: { type: 'string' },
          middleName: { type: 'string' },
          lastName: { type: 'string' },
          suffix: { type: 'string' },
        },
        required: ['name'],
        additionalProperties: false,
        ...('default' in field && field.default !== undefined && { default: field.default }),
      }

    case 'organization':
      return {
        type: 'object',
        properties: {
          name: { type: 'string' },
          legalName: { type: 'string' },
          domicile: { type: 'string' },
          entityType: { type: 'string' },
          entityId: { type: 'string' },
          taxId: { type: 'string' },
        },
        required: ['name'],
        additionalProperties: false,
        ...('default' in field && field.default !== undefined && { default: field.default }),
      }

    case 'identification':
      return {
        type: 'object',
        properties: {
          type: { type: 'string' },
          number: { type: 'string' },
          issuer: { type: 'string' },
          issueDate: { type: 'string', format: 'date' },
          expiryDate: { type: 'string', format: 'date' },
        },
        required: ['type', 'number'],
        additionalProperties: false,
        ...('default' in field && field.default !== undefined && { default: field.default }),
      }

    // New field types: Selection
    case 'multiselect':
      if ('enum' in field && Array.isArray(field.enum) && field.enum.length > 0) {
        const itemSchema: JsonSchema = {
          anyOf: (field.enum as RuntimeEnumOption[]).map((option) => ({ const: option.value })),
        }
        const schema: JsonSchema = {
          type: 'array',
          items: itemSchema,
          uniqueItems: true,
        }
        if ('min' in field && typeof field.min === 'number') {
          schema.minItems = field.min
        }
        if ('max' in field && typeof field.max === 'number') {
          schema.maxItems = field.max
        }
        if ('default' in field && field.default !== undefined) {
          schema.default = field.default
        }
        return schema
      }
      return { type: 'array', items: { type: 'string' } }

    // New field types: Numeric
    case 'percentage': {
      const percentageSchema: JsonSchema = {
        type: 'number',
      }
      if ('min' in field && typeof field.min === 'number') {
        percentageSchema.minimum = field.min
      }
      if ('max' in field && typeof field.max === 'number') {
        percentageSchema.maximum = field.max
      }
      if ('default' in field && field.default !== undefined) {
        percentageSchema.default = field.default
      }
      return percentageSchema
    }

    case 'rating': {
      const ratingSchema: JsonSchema = {
        type: 'number',
      }
      if ('min' in field && typeof field.min === 'number') {
        ratingSchema.minimum = field.min
      }
      if ('max' in field && typeof field.max === 'number') {
        ratingSchema.maximum = field.max
      }
      if ('default' in field && field.default !== undefined) {
        ratingSchema.default = field.default
      }
      return ratingSchema
    }

    case 'fieldset':
      if ('fields' in field && field.fields) {
        return compileFields(field.fields)
      }
      return { type: 'object', additionalProperties: false }

    default:
      // Fallback for unknown types
      return {}
  }
}

/**
 * Convert annex definitions into a data validation schema
 */
function compileAnnexes(annexes: Record<string, FormAnnex>): JsonSchema {
  const annexEntries = Object.entries(annexes)
  if (annexEntries.length === 0) {
    return { type: 'object', additionalProperties: false }
  }

  const properties: Record<string, JsonSchema> = {}
  const required: string[] = []

  for (const [annexId, annex] of annexEntries) {
    // Annexes typically contain files or references
    // For now, we'll accept any value (could be file descriptor, path, etc.)
    properties[annexId] = {
      description: annex.description || annex.title,
    }

    if (annex.required) {
      required.push(annexId)
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 && { required }),
    additionalProperties: false,
  }
}

// ============================================================================
// PARTY SCHEMAS - JSON Schema definitions for runtime party validation
// ============================================================================

/**
 * JSON Schema for a Person with required runtime `id` field.
 * Validates that a party is a Person entity.
 */
const PERSON_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1, maxLength: 200 },
    title: { type: 'string', minLength: 1, maxLength: 50 },
    firstName: { type: 'string', minLength: 1, maxLength: 100 },
    middleName: { type: 'string', minLength: 1, maxLength: 100 },
    lastName: { type: 'string', minLength: 1, maxLength: 100 },
    suffix: { type: 'string', minLength: 1, maxLength: 50 },
  },
  required: ['id', 'name'],
  additionalProperties: false,
}

/**
 * JSON Schema for an Organization with required runtime `id` field.
 * Validates that a party is an Organization entity.
 */
const ORGANIZATION_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1, maxLength: 200 },
    legalName: { type: 'string', minLength: 1, maxLength: 200 },
    domicile: { type: 'string', minLength: 1, maxLength: 100 },
    entityType: { type: 'string', minLength: 1, maxLength: 100 },
    entityId: { type: 'string', minLength: 1, maxLength: 100 },
    taxId: { type: 'string', minLength: 1, maxLength: 100 },
  },
  required: ['id', 'name'],
  additionalProperties: false,
}

/**
 * JSON Schema for a party that can be either Person or Organization.
 */
const ANY_PARTY_SCHEMA: JsonSchema = {
  anyOf: [PERSON_SCHEMA, ORGANIZATION_SCHEMA],
}

/**
 * Get the JSON Schema for a party based on its partyType constraint.
 *
 * @param partyType - The party type constraint ('person', 'organization', or 'any'/undefined)
 * @returns JSON Schema that validates the party type
 */
function getPartyTypeSchema(partyType: FormParty['partyType']): JsonSchema {
  switch (partyType) {
    case 'person':
      return PERSON_SCHEMA
    case 'organization':
      return ORGANIZATION_SCHEMA
    case 'any':
    default:
      return ANY_PARTY_SCHEMA
  }
}

/**
 * Compile a single party definition to its validation schema.
 * Handles single vs array based on max property.
 *
 * @param party - The party definition
 * @returns JSON Schema for validating this party's data
 */
function compileParty(party: FormParty): JsonSchema {
  const baseSchema = getPartyTypeSchema(party.partyType)
  const max = party.max ?? 1

  // If max > 1, party data can be an array
  if (max > 1) {
    return {
      anyOf: [
        baseSchema,
        {
          type: 'array',
          items: baseSchema,
          minItems: party.min ?? 1,
          maxItems: max,
        },
      ],
    }
  }

  // Single party (max === 1)
  return baseSchema
}

/**
 * Convert party definitions into a data validation schema.
 *
 * @param parties - Record of party definitions keyed by role ID
 * @returns JSON Schema for validating parties data
 */
function compileParties(parties: Record<string, FormParty>): JsonSchema {
  const partyEntries = Object.entries(parties)
  if (partyEntries.length === 0) {
    return { type: 'object', additionalProperties: false }
  }

  const properties: Record<string, JsonSchema> = {}
  const required: string[] = []

  for (const [roleId, party] of partyEntries) {
    properties[roleId] = compileParty(party)

    // Party is required if required is true (not an expression string)
    if (party.required === true) {
      required.push(roleId)
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 && { required }),
    additionalProperties: false,
  }
}

/**
 * Compile and return as plain JSON Schema object
 */
export function compileToJsonSchema(form: Form): JsonSchema {
  return compile(form)
}
