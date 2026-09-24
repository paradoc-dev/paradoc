/**
 * Two-way parity between `@paradoc/types` and the Zod schemas (D2).
 *
 * `@paradoc/types` stays Zod-free and is written by hand, so every exported
 * shape is proved equal to the `z.output` of its schema here. `toEqualTypeOf`
 * is a strict identity check: an optional key, a wider union member, or a
 * looser property type on either side fails `check-types`. `vitest run` runs
 * these as ordinary passing tests; `tsc --noEmit` is what enforces them.
 *
 * The recursive schemas (`FormFieldSchema`, `FieldsetFieldSchema`,
 * `ListFieldSchema`, `BundleSchema`) carry a `z.ZodType<T>` annotation, so
 * their own `z.output` is `T` by construction. Their parity is proved on the
 * unannotated object schemas instead, one level down: each recursive
 * reference resolves to the annotated type, so equality at that level proves
 * the whole shape by induction.
 *
 * To cover a new shape, add one `expectTypeOf` line that pairs the type with
 * its schema.
 */
import { describe, expectTypeOf, it } from 'vitest'
import type { z } from 'zod'
import type {
	Address,
	Artifact,
	ArtifactBase,
	Attachment,
	Bbox,
	Bundle,
	BundleContentItem,
	Checklist,
	ChecklistItem,
	CondExpr,
	ContentRef,
	Coordinate,
	DefsSection,
	Document,
	Duration,
	EnumField,
	Expression,
	ExpressionType,
	FieldsetField,
	Form,
	FormAnnex,
	FormField,
	FormParty,
	Identification,
	Layer,
	ListField,
	Metadata,
	Money,
	ObjectExpressionType,
	Organization,
	Person,
	Phone,
	RuleSeverity,
	RulesSection,
	RuntimeParty,
	ScalarExpressionType,
	Signature,
	SignatureSlot,
	SignatureSlotType,
	ValidationRule,
} from '@paradoc/types'
import {
	AddressSchema,
	ALL_EXPRESSION_TYPES,
	ArtifactSchema,
	AttachmentSchema,
	BboxSchema,
	BundleContentItemSchema,
	ChecklistItemSchema,
	ChecklistSchema,
	CondExprSchema,
	ContentRefSchema,
	CoordinateSchema,
	DefsSectionSchema,
	DocumentSchema,
	DurationSchema,
	ExpressionSchema,
	FormAnnexSchema,
	FormPartySchema,
	FormSchema,
	IdentificationSchema,
	LayerSchema,
	MetadataSchema,
	MoneySchema,
	OBJECT_EXPRESSION_TYPES,
	OrganizationSchema,
	PersonSchema,
	PhoneSchema,
	RuleSeveritySchema,
	RulesSectionSchema,
	RuntimeOrganizationSchema,
	RuntimePersonSchema,
	SCALAR_EXPRESSION_TYPES,
	SignatureSchema,
	SignatureSlotSchema,
	SignatureSlotTypeSchema,
	ValidationRuleSchema,
} from '../src'
import { BundleObjectSchema } from '../src/zod/artifacts/bundle'
import { FIELD_SCHEMAS, FieldsetFieldObjectSchema } from '../src/zod/artifacts/form/field'
import { ListFieldObjectSchema } from '../src/zod/artifacts/form/list'

type Out<S extends z.ZodType> = z.output<S>

/**
 * Flattens each member of a union into one object type. `toEqualTypeOf`
 * compares an intersection (`Person & { id: string }`) and the equal flat
 * object as different types, so an intersection is flattened first.
 */
type Flat<T> = T extends unknown ? { [K in keyof T]: T[K] } : never

/**
 * The option and allowed-type arrays on `EnumField`, `MultiselectField` and
 * `IdentificationField` are `readonly` on purpose, so an `as const` artifact
 * type-checks as a `Form`. The schema outputs mutable arrays. `readonly`
 * limits writes, not the data's shape, so these fields are compared with
 * their top-level arrays made mutable; every other difference still fails.
 */
type WritableArray<V> = V extends readonly (infer U)[] ? U[] : V
type WritableArrays<T> = T extends unknown ? { [K in keyof T]: WritableArray<T[K]> } : never

describe('primitives equal their schema output', () => {
	it('Money, Address, Phone', () => {
		expectTypeOf<Money>().toEqualTypeOf<Out<typeof MoneySchema>>()
		expectTypeOf<Address>().toEqualTypeOf<Out<typeof AddressSchema>>()
		expectTypeOf<Phone>().toEqualTypeOf<Out<typeof PhoneSchema>>()
	})

	it('Person, Organization, Identification', () => {
		expectTypeOf<Person>().toEqualTypeOf<Out<typeof PersonSchema>>()
		expectTypeOf<Organization>().toEqualTypeOf<Out<typeof OrganizationSchema>>()
		expectTypeOf<Identification>().toEqualTypeOf<Out<typeof IdentificationSchema>>()
	})

	it('Coordinate, Bbox, Duration', () => {
		expectTypeOf<Coordinate>().toEqualTypeOf<Out<typeof CoordinateSchema>>()
		expectTypeOf<Bbox>().toEqualTypeOf<Out<typeof BboxSchema>>()
		expectTypeOf<Duration>().toEqualTypeOf<Out<typeof DurationSchema>>()
	})

	it('Metadata, Attachment, Signature', () => {
		expectTypeOf<Metadata>().toEqualTypeOf<Out<typeof MetadataSchema>>()
		expectTypeOf<Attachment>().toEqualTypeOf<Out<typeof AttachmentSchema>>()
		expectTypeOf<Signature>().toEqualTypeOf<Out<typeof SignatureSchema>>()
	})

	it('RuntimeParty, a person or organization with its fill id', () => {
		expectTypeOf<Flat<RuntimeParty>>().toEqualTypeOf<
			Out<typeof RuntimePersonSchema> | Out<typeof RuntimeOrganizationSchema>
		>()
	})
})

describe('artifacts equal their schema output', () => {
	it('ArtifactBase, Form, Document, Checklist', () => {
		expectTypeOf<ArtifactBase>().toEqualTypeOf<Out<typeof ArtifactSchema>>()
		expectTypeOf<Form>().toEqualTypeOf<Out<typeof FormSchema>>()
		expectTypeOf<Document>().toEqualTypeOf<Out<typeof DocumentSchema>>()
		expectTypeOf<Checklist>().toEqualTypeOf<Out<typeof ChecklistSchema>>()
	})

	it('Bundle, through its unannotated object schema', () => {
		expectTypeOf<Bundle>().toEqualTypeOf<Out<typeof BundleObjectSchema>>()
		expectTypeOf<BundleContentItem>().toEqualTypeOf<Out<typeof BundleContentItemSchema>>()
	})

	it('the inline bundle item accepts exactly the four artifact kinds', () => {
		type InlineArtifact = Extract<Out<typeof BundleContentItemSchema>, { type: 'inline' }>['artifact']
		expectTypeOf<InlineArtifact>().toEqualTypeOf<Artifact>()
	})

	it('ChecklistItem', () => {
		expectTypeOf<ChecklistItem>().toEqualTypeOf<Out<typeof ChecklistItemSchema>>()
	})
})

describe('form blocks equal their schema output', () => {
	it('FormField, through the unannotated field union', () => {
		expectTypeOf<WritableArrays<FormField>>().toEqualTypeOf<Out<(typeof FIELD_SCHEMAS)[number]>>()
	})

	it('FieldsetField and ListField, through their object schemas', () => {
		expectTypeOf<FieldsetField>().toEqualTypeOf<Out<typeof FieldsetFieldObjectSchema>>()
		expectTypeOf<ListField>().toEqualTypeOf<Out<typeof ListFieldObjectSchema>>()
	})

	it('FormAnnex and FormParty', () => {
		expectTypeOf<FormAnnex>().toEqualTypeOf<Out<typeof FormAnnexSchema>>()
		expectTypeOf<FormParty>().toEqualTypeOf<Out<typeof FormPartySchema>>()
	})
})

describe('shared blocks equal their schema output', () => {
	it('Layer, SignatureSlot, SignatureSlotType, ContentRef', () => {
		expectTypeOf<Layer>().toEqualTypeOf<Out<typeof LayerSchema>>()
		expectTypeOf<SignatureSlot>().toEqualTypeOf<Out<typeof SignatureSlotSchema>>()
		expectTypeOf<SignatureSlotType>().toEqualTypeOf<Out<typeof SignatureSlotTypeSchema>>()
		expectTypeOf<ContentRef>().toEqualTypeOf<Out<typeof ContentRefSchema>>()
	})

	it('Expression, CondExpr, DefsSection', () => {
		expectTypeOf<Expression>().toEqualTypeOf<Out<typeof ExpressionSchema>>()
		expectTypeOf<CondExpr>().toEqualTypeOf<Out<typeof CondExprSchema>>()
		expectTypeOf<DefsSection>().toEqualTypeOf<Out<typeof DefsSectionSchema>>()
	})

	it('the expression type unions equal the runtime type lists', () => {
		expectTypeOf<ScalarExpressionType>().toEqualTypeOf<(typeof SCALAR_EXPRESSION_TYPES)[number]>()
		expectTypeOf<ObjectExpressionType>().toEqualTypeOf<(typeof OBJECT_EXPRESSION_TYPES)[number]>()
		expectTypeOf<ExpressionType>().toEqualTypeOf<(typeof ALL_EXPRESSION_TYPES)[number]>()
	})

	it('ValidationRule, RuleSeverity, RulesSection', () => {
		expectTypeOf<ValidationRule>().toEqualTypeOf<Out<typeof ValidationRuleSchema>>()
		expectTypeOf<RuleSeverity>().toEqualTypeOf<Out<typeof RuleSeveritySchema>>()
		expectTypeOf<RulesSection>().toEqualTypeOf<Out<typeof RulesSectionSchema>>()
	})
})

describe('drift on either side fails the check', () => {
	it('rejects a type with an optional key the schema does not have', () => {
		// @ts-expect-error `foo` exists on the type only; the strict schema would reject it.
		expectTypeOf<Form & { foo?: string }>().toEqualTypeOf<Out<typeof FormSchema>>()
	})

	it('rejects a schema output with an optional key the type does not have', () => {
		// @ts-expect-error `foo` exists on the schema output only.
		expectTypeOf<Form>().toEqualTypeOf<Out<typeof FormSchema> & { foo?: string }>()
	})

	it('rejects a field whose option shape differs, even with its arrays made mutable', () => {
		type LooseEnumField = Omit<EnumField, 'enum'> & { enum: readonly { value: string | number; hint?: string }[] }
		// @ts-expect-error `hint` is not an option key in the schema.
		expectTypeOf<WritableArrays<Flat<LooseEnumField>>>().toEqualTypeOf<Extract<Out<(typeof FIELD_SCHEMAS)[number]>, { type: 'enum' }>>()
	})

	it('rejects a type whose property is wider than the schema allows', () => {
		type LooseMoney = Omit<Money, 'amount'> & { amount: number | string }
		// @ts-expect-error `amount` is a number in the schema.
		expectTypeOf<LooseMoney>().toEqualTypeOf<Out<typeof MoneySchema>>()
	})
})
