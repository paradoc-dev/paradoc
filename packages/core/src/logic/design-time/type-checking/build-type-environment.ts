/**
 * Builds @paradoc/expr type environments from artifact definitions, and
 * topologically sorts defs keys for circular-dependency detection.
 *
 * Field reference paths (fields.<id>, nested complex-type properties such as
 * fields.rent.amount, and fieldset children) are mapped to their @paradoc/expr
 * types. Defs key types are INFERRED from their value expressions (via the
 * @paradoc/expr checker) in dependency order, so a key declared one type whose
 * expression returns another is detected transitively where it is used.
 */

import type {
  Form,
  Bundle,
  FormField,
  FieldsetField,
  ListField,
  EnumOption,
  Expression,
  DefsSection,
  ScalarExpressionType,
} from '@paradoc/types'
import { check, createTypeEnv, T, type ExprType, type TypeEnv } from '@paradoc/expr'
import { parseExpression } from '../validation/expression-parser'
import { isInlineBundleArtifact, isFormArtifact, isBundleArtifact } from '../validation/shared'
import { topologicalSort } from '../../shared/topological-sort'
import { defsDependencyExpressions } from '../../shared/defs-dependencies'

/** Scalar expression types (value is a string expression). */
const SCALAR_EXPRESSION_TYPES: Set<string> = new Set([
  'boolean',
  'string',
  'number',
  'integer',
  'percentage',
  'rating',
  'date',
  'time',
  'datetime',
  'duration',
])

function isScalarExpressionType(type: string): type is ScalarExpressionType {
  return SCALAR_EXPRESSION_TYPES.has(type)
}

// ============================================================================
// Field type mapping (Paradoc field types -> @paradoc/expr ExprType)
// ============================================================================

const FIELD_TYPE_TO_EXPR: Record<string, ExprType> = {
  text: T.string,
  email: T.string,
  uuid: T.string,
  uri: T.string,
  number: T.number,
  integer: T.number,
  percentage: T.number,
  rating: T.number,
  boolean: T.boolean,
  date: T.date,
  datetime: T.datetime,
  time: T.time,
  duration: T.duration,
  money: T.money,
  enum: T.unknown,
  multiselect: T.array(T.unknown),
  coordinate: T.object,
  address: T.object,
  phone: T.object,
  bbox: T.object,
  person: T.object,
  organization: T.object,
  identification: T.object,
  signature: T.object,
  fieldset: T.object,
  list: T.array(T.unknown),
}

/**
 * Statically known properties exposed by object-valued definition expressions.
 * A nested member is keyed by its dotted path, such as `southWest.lat`.
 */
export const DEFINITION_PROPERTY_TYPES: Record<string, Record<string, ExprType>> = {
  money: { amount: T.number, currency: T.string },
  address: {
    line1: T.string,
    line2: T.string,
    locality: T.string,
    region: T.string,
    postalCode: T.string,
    country: T.string,
  },
  phone: { number: T.string, type: T.string, extension: T.string },
  coordinate: { lat: T.number, lon: T.number },
  bbox: {
    southWest: T.object,
    'southWest.lat': T.number,
    'southWest.lon': T.number,
    northEast: T.object,
    'northEast.lat': T.number,
    'northEast.lon': T.number,
  },
  person: {
    name: T.string,
    firstName: T.string,
    middleName: T.string,
    lastName: T.string,
    suffix: T.string,
    title: T.string,
  },
  organization: {
    name: T.string,
    legalName: T.string,
    domicile: T.string,
    entityType: T.string,
    entityId: T.string,
    taxId: T.string,
  },
  identification: {
    type: T.string,
    number: T.string,
    issuer: T.string,
    issueDate: T.date,
    expiryDate: T.date,
  },
}

/** Nested property types for complex field types (mirrors field-paths.ts). */
const COMPLEX_PROPERTY_TYPES: Record<string, Record<string, ExprType>> = {
  money: { amount: T.number, currency: T.string },
  address: {
    line1: T.string,
    line2: T.string,
    locality: T.string,
    region: T.string,
    postalCode: T.string,
    country: T.string,
  },
  phone: { number: T.string, type: T.string, extension: T.string },
  coordinate: { lat: T.number, lon: T.number },
  bbox: {
    southWest: T.object,
    'southWest.lat': T.number,
    'southWest.lon': T.number,
    northEast: T.object,
    'northEast.lat': T.number,
    'northEast.lon': T.number,
  },
  duration: {
    years: T.number,
    months: T.number,
    weeks: T.number,
    days: T.number,
    hours: T.number,
    minutes: T.number,
    seconds: T.number,
  },
  person: {
    name: T.string,
    firstName: T.string,
    middleName: T.string,
    lastName: T.string,
    suffix: T.string,
    title: T.string,
  },
  organization: { name: T.string, legalName: T.string, entityType: T.string, domicile: T.string },
  identification: {
    idType: T.string,
    idNumber: T.string,
    issuingAuthority: T.string,
    issuedDate: T.date,
    expiryDate: T.date,
  },
}

function enumOptionExprType(options: readonly EnumOption[]): ExprType {
  const kinds = new Set(options.map((option) => typeof option.value))
  if (kinds.size !== 1) return T.unknown
  return kinds.has('number') ? T.number : T.string
}

function fieldExprType(field: FormField): ExprType {
  if (field.type === 'list') return T.array(fieldExprType(field.item))
  if (field.type === 'enum') return enumOptionExprType(field.enum)
  if (field.type === 'multiselect') return T.array(enumOptionExprType(field.enum))
  return FIELD_TYPE_TO_EXPR[field.type] ?? T.unknown
}

/** The declared type of an object-valued defs key (scalars are inferred). */
function objectDefsExprType(expr: Expression): ExprType {
  return expr.type === 'money' ? T.money : T.object
}

/** Registers an expression definition and its statically known object members. */
function registerDefType(
  key: string,
  expr: Expression,
  acc: Record<string, ExprType>,
  keyPrefix: string,
): void {
  const fullKey = `${keyPrefix}${key}`
  acc[fullKey] = isScalarExpressionType(expr.type)
    ? check(expr.value as string, createTypeEnv(acc)).type
    : objectDefsExprType(expr)

  const properties = DEFINITION_PROPERTY_TYPES[expr.type]
  if (properties) {
    for (const [property, propertyType] of Object.entries(properties)) {
      acc[`${fullKey}.${property}`] = propertyType
    }
  }
}

/**
 * Registers the members of one field's value under `path`: complex-type
 * properties and fieldset children. A list's item members are registered under
 * the list's own path, typed per row, so `fields.items.amount` is the type of
 * one row's amount; the checker only accepts such a path inside an aggregate.
 */
function registerMemberTypes(field: FormField, path: string, acc: Record<string, ExprType>): void {
  const props = COMPLEX_PROPERTY_TYPES[field.type]
  if (props) {
    for (const [prop, propType] of Object.entries(props)) {
      acc[`${path}.${prop}`] = propType
    }
  }

  if (field.type === 'fieldset') {
    const fieldset = field as FieldsetField
    if (fieldset.fields) {
      registerFieldTypes(fieldset.fields, path, acc)
    }
  } else if (field.type === 'list') {
    registerMemberTypes(field.item, path, acc)
  }
}

/** Registers field reference paths and their types into the accumulator. */
function registerFieldTypes(
  fields: Record<string, FormField> | undefined,
  prefix: string,
  acc: Record<string, ExprType>
): void {
  if (!fields) return

  for (const [fieldId, field] of Object.entries(fields)) {
    const fieldPath = `${prefix}.${fieldId}`
    acc[fieldPath] = fieldExprType(field)
    registerMemberTypes(field, fieldPath, acc)
  }
}

// ============================================================================
// List row references (`item`, `parent`)
// ============================================================================

/** Reserved names that refer to list rows inside list-item expressions. */
export const ROW_REFERENCE_NAMES = ['item', 'parent'] as const
export type RowReferenceName = (typeof ROW_REFERENCE_NAMES)[number]

/**
 * The list rows an expression can see. `item` is the item definition of the
 * innermost list enclosing the expression; `parent` is the item definition of
 * the list that encloses that list, when one exists.
 */
export interface ListRowScope {
  readonly item: FormField
  readonly parent?: FormField
}

/** The row scope for expressions inside an item of `list`, nested in `outer`. */
export function enterListRow(list: ListField, outer: ListRowScope | undefined): ListRowScope {
  return outer ? { item: list.item, parent: outer.item } : { item: list.item }
}

/**
 * Reference paths and types a row scope exposes: `item` and its members, plus
 * `parent` and its members when an enclosing row exists.
 */
export function rowScopeTypes(scope: ListRowScope): Record<string, ExprType> {
  const acc: Record<string, ExprType> = {}
  const register = (root: RowReferenceName, row: FormField): void => {
    acc[root] = fieldExprType(row)
    const props = COMPLEX_PROPERTY_TYPES[row.type]
    if (props) {
      for (const [prop, propType] of Object.entries(props)) acc[`${root}.${prop}`] = propType
    }
    if (row.type === 'fieldset') registerFieldTypes(row.fields, root, acc)
  }
  register('item', scope.item)
  if (scope.parent) register('parent', scope.parent)
  return acc
}

/** Whether a reference path is rooted at a row reference (`item`, `parent`). */
export function isRowReferencePath(path: string): boolean {
  const root = path.split('.')[0]
  return root === 'item' || root === 'parent'
}

/**
 * A type environment that resolves row references from `scope` only, so an
 * enclosing row's members never leak into a nested row, and every other path
 * from `env`.
 */
export function withRowScopeTypes(env: TypeEnv, scope: ListRowScope): TypeEnv {
  const rows = new Map(Object.entries(rowScopeTypes(scope)))
  return {
    resolve: (path) => (isRowReferencePath(path) ? rows.get(path) : env.resolve(path)),
    registry: env.registry,
  }
}

// ============================================================================
// Topological sort of defs keys (circular-dependency detection)
// ============================================================================

/**
 * Result of topological sorting defs keys.
 */
export interface TopologicalSortResult {
  /** Keys in dependency order */
  sorted: string[]
  /** Keys involved in circular dependencies (if any) */
  cyclicKeys: string[]
}

/**
 * Topologically sorts defs keys based on their dependencies.
 *
 * Ensures that if key A references key B, B comes before A in the result.
 * Detects and reports circular dependencies.
 *
 * @param logic - The defs section with key-to-expression mappings
 * @returns Object containing sorted keys and any cyclic keys
 */
export function topologicalSortDefsKeys(logic: Record<string, string>): TopologicalSortResult {
  const keys = Object.keys(logic)
  const keySet = new Set(keys)

  // Each key depends on the other defs keys its expression references. Object
  // definition members (for example `total.amount`) depend on their base key.
  const dependencies = new Map<string, string[]>()
  for (const key of keys) {
    const expr = logic[key]
    const parsed = expr ? parseExpression(expr) : undefined
    dependencies.set(
      key,
      parsed && parsed.success
        ? parsed.variables
            .map((variable) => variable.split('.')[0]!)
            .filter((variable) => keySet.has(variable))
        : []
    )
  }

  const { sorted, cyclic } = topologicalSort(keys, (k) => dependencies.get(k) ?? [])
  return { sorted, cyclicKeys: [...cyclic] }
}

// ============================================================================
// Type environment construction
// ============================================================================

/**
 * Infers each defs key's type from its value expression (in dependency order)
 * and registers it under `keyPrefix + key`. Scalar defs are inferred via the
 * checker; object-valued defs use their declared type.
 */
function inferDefsInto(
  defs: DefsSection,
  acc: Record<string, ExprType>,
  keyPrefix: string
): void {
  const { sorted } = topologicalSortDefsKeys(defsDependencyExpressions(defs))
  for (const key of sorted) {
    const expr = defs[key]
    if (!expr) continue
    registerDefType(key, expr, acc, keyPrefix)
  }
}

/** Members a party value carries: its identity, and the person or organization parts its type allows. */
export function partyMemberTypes(partyType: string | undefined): Record<string, ExprType> {
  const person = DEFINITION_PROPERTY_TYPES.person!
  const organization = DEFINITION_PROPERTY_TYPES.organization!
  const identity = partyType === 'person'
    ? person
    : partyType === 'organization'
      ? organization
      : { ...person, ...organization }
  return { id: T.string, ...identity }
}

/**
 * Registers `parties.<role>`: one party, or a list for a role that allows
 * several. A list role's members are typed per row, so `parties.tenant.name`
 * is one tenant's name and reads inside an aggregate or a loop.
 */
export function registerPartyTypes(
  parties: Form['parties'],
  acc: Record<string, ExprType>,
  extraMembers: Record<string, ExprType> = {},
): void {
  for (const [role, party] of Object.entries(parties ?? {})) {
    const path = `parties.${role}`
    acc[path] = (party.max ?? 1) > 1 ? T.array(T.object) : T.object
    for (const [member, type] of Object.entries({ ...partyMemberTypes(party.partyType), ...extraMembers })) {
      acc[`${path}.${member}`] = type
    }
  }
}

/** Field + inferred-defs types for a Form, in form-local paths. */
export function buildFormTypeAcc(form: Form): Record<string, ExprType> {
  const acc: Record<string, ExprType> = {}
  registerFieldTypes(form.fields, 'fields', acc)
  registerPartyTypes(form.parties, acc)
  if (form.defs) inferDefsInto(form.defs, acc, '')
  return acc
}

/**
 * Builds an @paradoc/expr type environment from a Form artifact, with the
 * default function registry (which includes the party/witness predicates).
 */
export function buildFormTypeEnvironment(form: Form): TypeEnv {
  return createTypeEnv(buildFormTypeAcc(form))
}

/**
 * Builds the type environment used by form-level rules. Rules may address
 * fields directly (`amount`) as well as through the qualified `fields.amount`
 * path used by other form expressions.
 */
export function buildFormRuleTypeEnvironment(form: Form): TypeEnv {
  const acc = buildFormTypeAcc(form)
  // Rule contexts expose the same values both as `fields.<path>` and as
  // direct paths (`fieldId`, `fieldId.member`). Copy every field path so
  // complex and nested values retain their member types in either form.
  for (const [path, type] of Object.entries(acc)) {
    if (!path.startsWith('fields.')) continue
    const directPath = path.slice('fields.'.length)
    // Runtime rule contexts add defs after fields, so a defs key wins when a
    // form happens to use the same direct name for both.
    if (!(directPath in acc)) acc[directPath] = type
  }
  return createTypeEnv(acc)
}

/** Field + inferred-defs types for a Bundle, with forms.<k>./bundles.<k>. prefixes. */
function buildBundleTypeAcc(bundle: Bundle): Record<string, ExprType> {
  const acc: Record<string, ExprType> = {}

  for (const item of bundle.contents) {
    if (!isInlineBundleArtifact(item)) continue
    if (isFormArtifact(item.artifact)) {
      const formAcc = buildFormTypeAcc(item.artifact)
      for (const [path, type] of Object.entries(formAcc)) {
        acc[`forms.${item.key}.${path}`] = type
      }
    } else if (isBundleArtifact(item.artifact)) {
      const nestedAcc = buildBundleTypeAcc(item.artifact)
      for (const [path, type] of Object.entries(nestedAcc)) {
        acc[`bundles.${item.key}.${path}`] = type
      }
    }
  }

  // Bundle-level defs are inferred last, so they see the inline content paths.
  if (bundle.defs) inferDefsInto(bundle.defs, acc, '')
  return acc
}

/**
 * Builds an @paradoc/expr type environment from a Bundle artifact.
 *
 * Inline form fields are registered as `forms.<key>.fields.<fieldId>`; nested
 * bundles are prefixed with `bundles.<key>.`.
 */
export function buildBundleTypeEnvironment(bundle: Bundle): TypeEnv {
  return createTypeEnv(buildBundleTypeAcc(bundle))
}
