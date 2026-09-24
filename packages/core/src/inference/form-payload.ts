import type {
  Form,
  FormField,
  FormAnnex,
  FormParty,
  Address,
  Bbox,
  Coordinate,
  Identification,
  Money,
  Person,
  Organization,
  Phone,
  Attachment,
} from '@paradoc/types'
import { ISO_8601_DURATION_PATTERN } from '@paradoc/schemas'
import { TIME_PATTERN } from '@/primitives/time'
import { compositeJsonSchema } from './composite-shapes'

type EnumOptionValue<T> = T extends { value: infer V } ? V : never
type RuntimeEnumOption = { value: string | number }

// JSON Schema type for compiled output
export type JsonSchema = {
  type?: string
  properties?: Record<string, JsonSchema>
  required?: string[]
  additionalProperties?: boolean | JsonSchema
  items?: JsonSchema
  anyOf?: JsonSchema[]
  const?: unknown
  minimum?: number
  maximum?: number
  formatMinimum?: string
  formatMaximum?: string
  multipleOf?: number
  uniqueItems?: boolean
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
              ? Coordinate
              : F extends { type: 'bbox' }
                ? Bbox
                : F extends { type: 'money' }
                  ? Money
                  : F extends { type: 'address' }
                    ? Address
                    : F extends { type: 'phone' }
                      ? Phone
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
                                  ? Person
                                  : F extends { type: 'organization' }
                                    ? Organization
                                    : F extends { type: 'identification' }
                                      ? Identification
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
                                              : F extends { type: 'list'; item: infer Item }
                                                ? Item extends FormField
                                                  ? FieldToDataType<Item>[]
                                                  : never
                                                : unknown

/**
 * Helper type to check if a field should be treated as required.
 *
 * Strategy:
 * 1. Object pattern with `required: true` → required (literal type preserved)
 * 2. Builder patterns preserve the literal required flag through `build()`
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
 * - Fields with `required: true` (including builder fields with `.required()`) become required properties
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
 * Makes an inferred payload recursively optional for progressive filling.
 * Arrays remain replaceable values while object members can be supplied
 * independently at any depth.
 */
export type DeepPartial<T> = T extends readonly (infer Item)[]
  ? Array<DeepPartial<Item>>
  : T extends object
    ? { -readonly [K in keyof T]?: DeepPartial<T[K]> }
    : T

/**
 * Helper to extract the form schema from either a raw Form or FormInstance
 */
type ExtractFormSchema<T> = T extends { _data: infer S }
  ? S
  : T extends { _schema: infer S }
    ? S
    : T extends { schema: infer S }
      ? S
      : T

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
 * Party data accepts both single and array forms because a role's `max` is a
 * plain `number` at the type level, so the count a role takes is only known at
 * runtime.
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

type RequiredKeys<Definitions extends Record<string, unknown>> = {
  [K in keyof Definitions]-?: Definitions[K] extends { required: true } ? K : never
}[keyof Definitions]

type FieldsPayload<FormSchema> = FormSchema extends { fields: infer F }
  ? [NonNullable<F>] extends [never]
    ? { fields?: Record<string, unknown> }
    : NonNullable<F> extends Record<string, FormField>
      ? { fields: FieldsToDataType<NonNullable<F>> }
      : { fields?: Record<string, unknown> }
  : { fields?: Record<string, unknown> }

type PartiesPayload<FormSchema> = FormSchema extends { parties: infer P }
  ? [NonNullable<P>] extends [never]
    ? { parties?: Record<string, RuntimePerson | RuntimeOrganization | (RuntimePerson | RuntimeOrganization)[]> }
    : NonNullable<P> extends Record<string, FormParty>
      ? [RequiredKeys<NonNullable<P>>] extends [never]
        ? { parties?: PartiesToDataType<NonNullable<P>> }
        : { parties: PartiesToDataType<NonNullable<P>> }
      : { parties?: Record<string, RuntimePerson | RuntimeOrganization | (RuntimePerson | RuntimeOrganization)[]> }
  : { parties?: Record<string, RuntimePerson | RuntimeOrganization | (RuntimePerson | RuntimeOrganization)[]> }

/**
 * Extra annex keys a form with declared annexes accepts: any Attachment when
 * the schema has a literal `allowAdditionalAnnexes: true` (the builder and the
 * object pattern both keep the literal), none otherwise. The runtime default
 * is `false`. A form without declared annexes keeps the open
 * `Record<string, Attachment>` so it stays assignable to the generic `Form`.
 */
type AdditionalAnnexes<FormSchema> = FormSchema extends { allowAdditionalAnnexes: true }
  ? Record<string, Attachment>
  : unknown

type AnnexesPayload<FormSchema> = FormSchema extends { annexes: infer A }
  ? [NonNullable<A>] extends [never]
    ? { annexes?: Record<string, Attachment> }
    : NonNullable<A> extends Record<string, FormAnnex>
      ? [RequiredKeys<NonNullable<A>>] extends [never]
        ? { annexes?: AnnexesToDataType<NonNullable<A>> & AdditionalAnnexes<FormSchema> }
        : { annexes: AnnexesToDataType<NonNullable<A>> & AdditionalAnnexes<FormSchema> }
      : { annexes?: Record<string, Attachment> }
  : { annexes?: Record<string, Attachment> }

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
type InferFormDataInternal<FormSchema> = FieldsPayload<FormSchema> &
  PartiesPayload<FormSchema> &
  AnnexesPayload<FormSchema>

type UnknownFormData = {
  fields?: Record<string, unknown>
  parties?: Record<string, RuntimePerson | RuntimeOrganization | (RuntimePerson | RuntimeOrganization)[]>
  annexes?: Record<string, Attachment>
}

export type InferFormData<Form> = [Form] extends [never]
  ? UnknownFormData
  : InferFormDataInternal<ExtractFormSchema<Form>>

/**
 * Infers the complete data payload type from a form definition with full type expansion.
 * This version expands the type so IDE hovers show the actual structure like:
 *   { fields: { age: number; name: string | undefined } }
 * instead of:
 *   { fields: FieldsToDataType<...> }
 *
 * @example
 * ```typescript
 * const myForm = p.form({
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
 * Payload accepted by fill/update operations.
 * Unlike InferFormPayload, nested object members are optional so a patch can
 * update one member without repeating its siblings. Arrays are supplied as a
 * complete replacement value.
 */
export type ProgressiveFormPayload<Form> = DeepPartial<InferFormPayload<Form>>

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

  // Compile annexes. Undeclared annex ids are accepted only when the form
  // allows additional annexes, and each one must still be an Attachment.
  properties.annexes = compileAnnexes(form.annexes ?? {}, form.allowAdditionalAnnexes === true)
  if (Object.values(form.annexes ?? {}).some((annex) => annex.required === true)) {
    required.push('annexes')
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

/** Adds a field's declared default to its compiled value schema. */
function withDefault(schema: JsonSchema, field: FormField): JsonSchema {
  if ('default' in field && field.default !== undefined) schema.default = field.default
  return schema
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
        ...(field.type === 'email' && { format: 'email' }),
        ...(field.type === 'uri' && { format: 'uri' }),
        ...(field.type === 'uuid' && { format: 'uuid' }),
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
      if ('step' in field && typeof field.step === 'number') {
        numberSchema.multipleOf = field.step
      }
      if ('default' in field && field.default !== undefined) {
        numberSchema.default = field.default
      }
      return numberSchema
    }

    case 'coordinate':
    case 'bbox':
    case 'address':
    case 'phone':
    case 'person':
    case 'organization':
      return withDefault(compositeJsonSchema(field.type), field)

    case 'money': {
      const schema = compositeJsonSchema('money')
      const amount = schema.properties!.amount!
      if (typeof field.min === 'number') amount.minimum = field.min
      if (typeof field.max === 'number') amount.maximum = field.max
      if (typeof field.currency === 'string') schema.properties!.currency!.const = field.currency
      return withDefault(schema, field)
    }

    case 'identification': {
      const schema = compositeJsonSchema('identification')
      if (field.allowedTypes !== undefined) schema.properties!.type!.enum = [...field.allowedTypes]
      return withDefault(schema, field)
    }

    case 'duration':
      return {
        type: 'string',
        pattern: ISO_8601_DURATION_PATTERN,
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
        ...('min' in field && field.min !== undefined && { formatMinimum: field.min }),
        ...('max' in field && field.max !== undefined && { formatMaximum: field.max }),
        ...('default' in field && field.default !== undefined && { default: field.default }),
      }

    case 'datetime':
      return {
        type: 'string',
        format: 'date-time',
        ...('min' in field && field.min !== undefined && { formatMinimum: field.min }),
        ...('max' in field && field.max !== undefined && { formatMaximum: field.max }),
        ...('default' in field && field.default !== undefined && { default: field.default }),
      }

    case 'time':
      return {
        type: 'string',
        format: 'time',
        // Same pattern the `time` primitive validates against (@/primitives/time.ts).
        pattern: TIME_PATTERN,
        ...('min' in field && field.min !== undefined && { formatMinimum: field.min }),
        ...('max' in field && field.max !== undefined && { formatMaximum: field.max }),
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
      if ('step' in field && typeof field.step === 'number') {
        ratingSchema.multipleOf = field.step
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

    case 'list':
      return {
        type: 'array',
        items: compileField(field.item),
        ...(field.minItems !== undefined && { minItems: field.minItems }),
        ...(field.maxItems !== undefined && { maxItems: field.maxItems }),
      }

    default:
      // Fallback for unknown types
      return {}
  }
}

/**
 * JSON Schema for an annex value: the Attachment primitive (`AttachmentSchema`
 * in @paradoc/schemas). Every annex slot holds exactly one Attachment.
 */
const ATTACHMENT_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 255 },
    mimeType: { type: 'string', minLength: 1, maxLength: 100 },
    checksum: { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' },
  },
  required: ['name', 'mimeType'],
  additionalProperties: false,
}

/**
 * Convert annex definitions into a data validation schema. With
 * `allowAdditional`, an undeclared annex id is accepted and its value is
 * checked against the Attachment shape; without it, an undeclared id fails.
 */
function compileAnnexes(annexes: Record<string, FormAnnex>, allowAdditional: boolean): JsonSchema {
  const additionalProperties = allowAdditional ? ATTACHMENT_SCHEMA : false
  const annexEntries = Object.entries(annexes)
  if (annexEntries.length === 0) {
    return { type: 'object', additionalProperties }
  }

  const properties: Record<string, JsonSchema> = {}
  const required: string[] = []

  for (const [annexId, annex] of annexEntries) {
    const description = annex.description || annex.title
    properties[annexId] = {
      ...ATTACHMENT_SCHEMA,
      ...(description !== undefined && { description }),
    }

    if (annex.required === true) {
      required.push(annexId)
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 && { required }),
    additionalProperties,
  }
}

// ============================================================================
// PARTY SCHEMAS - JSON Schema definitions for runtime party validation
// ============================================================================

/**
 * JSON Schema for a party value: the Person or Organization primitive plus the
 * runtime `id` that identifies the party.
 */
function partySchema(type: 'person' | 'organization'): JsonSchema {
  const schema = compositeJsonSchema(type)
  return {
    ...schema,
    properties: { id: { type: 'string', minLength: 1 }, ...schema.properties },
    required: ['id', ...(schema.required ?? [])],
  }
}

const PERSON_SCHEMA = partySchema('person')
const ORGANIZATION_SCHEMA = partySchema('organization')

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

  // If max > 1, party data can be an array. An empty list counts as an absent
  // role, so only a role that is always required sets a minimum here; party
  // validation applies `min` to a list that names parties.
  if (max > 1) {
    return {
      anyOf: [
        baseSchema,
        {
          type: 'array',
          items: baseSchema,
          ...(party.required === true && { minItems: Math.max(party.min ?? 1, 1) }),
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
