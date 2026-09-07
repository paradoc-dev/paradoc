/**
 * Closure-based field builders for artifacts.
 *
 * Uses factory functions and object composition instead of class inheritance.
 * Each builder returns an object literal with chainable methods.
 */

import type {
	FormField,
	FieldsetField,
	TextField,
	BooleanField,
	NumberField,
	CoordinateField,
	BboxField,
	MoneyField,
	AddressField,
	PhoneField,
	DurationField,
	EmailField,
	UuidField,
	UriField,
	EnumOption,
	EnumOptionValue,
	EnumField,
	DateField,
	DatetimeField,
	TimeField,
	PersonField,
	OrganizationField,
	IdentificationField,
	MultiselectField,
	PercentageField,
	RatingField,
	ListField,
	Coordinate,
	Bbox,
	Money,
	Address,
	Phone,
	Duration,
	Person,
	Organization,
	Identification,
} from '@paradoc/types';

import { parseFormField } from '@/validation/artifact-parsers';
import { type Buildable, resolveBuildable } from '@/artifacts/shared/buildable';

// Condition expression type (boolean or string expression)
type CondExpr = boolean | string;

type BuiltField<F extends FormField, R extends CondExpr | undefined> = R extends undefined
	? F
	: F & { required: R }

type BuiltFieldDefinition<D extends Buildable<FormField>> = D extends { build(): infer T extends FormField }
	? T
	: D extends FormField
		? D
		: FormField

type AddFieldDefinition<
	Existing extends Record<string, FormField>,
	K extends string,
	Definition extends FormField,
> = string extends K
	? Existing extends Record<string, never>
		? Record<string, Definition>
		: Existing & Record<string, Definition>
	: Existing extends Record<string, never>
		? { [P in K]: Definition }
		: Omit<Existing, K> & { [P in K]: Definition }

type FieldsetFieldWithFields<Fields extends Record<string, FormField>> = Omit<FieldsetField, 'fields'> & {
	fields: Fields
}

type ListFieldWithItem<Item extends FormField> = Omit<ListField, 'item'> & {
	item: Item
}

// ============================================================================
// Validation
// ============================================================================

function parseField(input: unknown): FormField {
	return parseFormField(input);
}

function resolveFieldDefinition(fieldDef: Buildable<FormField>): FormField {
	const resolved = resolveBuildable(fieldDef);

	if (resolved.type === 'fieldset') {
		return parseField({
			...resolved,
			fields: Object.fromEntries(
				Object.entries(resolved.fields).map(([id, nestedField]) => [id, resolveFieldDefinition(nestedField)]),
			),
		});
	}

	if (resolved.type === 'list') {
		return parseField({
			...resolved,
			item: resolveFieldDefinition(resolved.item),
		});
	}

	return parseField(resolved);
}

// ============================================================================
// Field Builder Types (for external use)
// ============================================================================

export interface TextFieldBuilder<R extends CondExpr | undefined = undefined> {
	label(value: string): TextFieldBuilder<R>;
	description(value: string): TextFieldBuilder<R>;
	required(): TextFieldBuilder<true>;
	required(value: undefined): TextFieldBuilder<true>;
	required<const V extends CondExpr>(value: V): TextFieldBuilder<V>;
	visible(value?: CondExpr): TextFieldBuilder<R>;
	minLength(value: number): TextFieldBuilder<R>;
	maxLength(value: number): TextFieldBuilder<R>;
	pattern(value: string): TextFieldBuilder<R>;
	default(value: string): TextFieldBuilder<R>;
	build(): BuiltField<TextField, R>;
}

export interface BooleanFieldBuilder<R extends CondExpr | undefined = undefined> {
	label(value: string): BooleanFieldBuilder<R>;
	description(value: string): BooleanFieldBuilder<R>;
	required(): BooleanFieldBuilder<true>;
	required(value: undefined): BooleanFieldBuilder<true>;
	required<const V extends CondExpr>(value: V): BooleanFieldBuilder<V>;
	visible(value?: CondExpr): BooleanFieldBuilder<R>;
	default(value: boolean): BooleanFieldBuilder<R>;
	build(): BuiltField<BooleanField, R>;
}

export interface NumberFieldBuilder<R extends CondExpr | undefined = undefined> {
	label(value: string): NumberFieldBuilder<R>;
	description(value: string): NumberFieldBuilder<R>;
	required(): NumberFieldBuilder<true>;
	required(value: undefined): NumberFieldBuilder<true>;
	required<const V extends CondExpr>(value: V): NumberFieldBuilder<V>;
	visible(value?: CondExpr): NumberFieldBuilder<R>;
	min(value: number): NumberFieldBuilder<R>;
	max(value: number): NumberFieldBuilder<R>;
	default(value: number): NumberFieldBuilder<R>;
	build(): BuiltField<NumberField, R>;
}

export interface CoordinateFieldBuilder<R extends CondExpr | undefined = undefined> {
	label(value: string): CoordinateFieldBuilder<R>;
	description(value: string): CoordinateFieldBuilder<R>;
	required(): CoordinateFieldBuilder<true>;
	required(value: undefined): CoordinateFieldBuilder<true>;
	required<const V extends CondExpr>(value: V): CoordinateFieldBuilder<V>;
	visible(value?: CondExpr): CoordinateFieldBuilder<R>;
	default(value: Coordinate): CoordinateFieldBuilder<R>;
	build(): BuiltField<CoordinateField, R>;
}

export interface BboxFieldBuilder<R extends CondExpr | undefined = undefined> {
	label(value: string): BboxFieldBuilder<R>;
	description(value: string): BboxFieldBuilder<R>;
	required(): BboxFieldBuilder<true>;
	required(value: undefined): BboxFieldBuilder<true>;
	required<const V extends CondExpr>(value: V): BboxFieldBuilder<V>;
	visible(value?: CondExpr): BboxFieldBuilder<R>;
	default(value: Bbox): BboxFieldBuilder<R>;
	build(): BuiltField<BboxField, R>;
}

export interface MoneyFieldBuilder<R extends CondExpr | undefined = undefined> {
	label(value: string): MoneyFieldBuilder<R>;
	description(value: string): MoneyFieldBuilder<R>;
	required(): MoneyFieldBuilder<true>;
	required(value: undefined): MoneyFieldBuilder<true>;
	required<const V extends CondExpr>(value: V): MoneyFieldBuilder<V>;
	visible(value?: CondExpr): MoneyFieldBuilder<R>;
	min(value: number): MoneyFieldBuilder<R>;
	max(value: number): MoneyFieldBuilder<R>;
	default(value: Money): MoneyFieldBuilder<R>;
	build(): BuiltField<MoneyField, R>;
}

export interface AddressFieldBuilder<R extends CondExpr | undefined = undefined> {
	label(value: string): AddressFieldBuilder<R>;
	description(value: string): AddressFieldBuilder<R>;
	required(): AddressFieldBuilder<true>;
	required(value: undefined): AddressFieldBuilder<true>;
	required<const V extends CondExpr>(value: V): AddressFieldBuilder<V>;
	visible(value?: CondExpr): AddressFieldBuilder<R>;
	default(value: Address): AddressFieldBuilder<R>;
	build(): BuiltField<AddressField, R>;
}

export interface PhoneFieldBuilder<R extends CondExpr | undefined = undefined> {
	label(value: string): PhoneFieldBuilder<R>;
	description(value: string): PhoneFieldBuilder<R>;
	required(): PhoneFieldBuilder<true>;
	required(value: undefined): PhoneFieldBuilder<true>;
	required<const V extends CondExpr>(value: V): PhoneFieldBuilder<V>;
	visible(value?: CondExpr): PhoneFieldBuilder<R>;
	default(value: Phone): PhoneFieldBuilder<R>;
	build(): BuiltField<PhoneField, R>;
}

export interface DurationFieldBuilder<R extends CondExpr | undefined = undefined> {
	label(value: string): DurationFieldBuilder<R>;
	description(value: string): DurationFieldBuilder<R>;
	required(): DurationFieldBuilder<true>;
	required(value: undefined): DurationFieldBuilder<true>;
	required<const V extends CondExpr>(value: V): DurationFieldBuilder<V>;
	visible(value?: CondExpr): DurationFieldBuilder<R>;
	default(value: Duration): DurationFieldBuilder<R>;
	build(): BuiltField<DurationField, R>;
}

export interface EmailFieldBuilder<R extends CondExpr | undefined = undefined> {
	label(value: string): EmailFieldBuilder<R>;
	description(value: string): EmailFieldBuilder<R>;
	required(): EmailFieldBuilder<true>;
	required(value: undefined): EmailFieldBuilder<true>;
	required<const V extends CondExpr>(value: V): EmailFieldBuilder<V>;
	visible(value?: CondExpr): EmailFieldBuilder<R>;
	minLength(value: number): EmailFieldBuilder<R>;
	maxLength(value: number): EmailFieldBuilder<R>;
	pattern(value: string): EmailFieldBuilder<R>;
	default(value: string): EmailFieldBuilder<R>;
	build(): BuiltField<EmailField, R>;
}

export interface UuidFieldBuilder<R extends CondExpr | undefined = undefined> {
	label(value: string): UuidFieldBuilder<R>;
	description(value: string): UuidFieldBuilder<R>;
	required(): UuidFieldBuilder<true>;
	required(value: undefined): UuidFieldBuilder<true>;
	required<const V extends CondExpr>(value: V): UuidFieldBuilder<V>;
	visible(value?: CondExpr): UuidFieldBuilder<R>;
	minLength(value: number): UuidFieldBuilder<R>;
	maxLength(value: number): UuidFieldBuilder<R>;
	pattern(value: string): UuidFieldBuilder<R>;
	default(value: string): UuidFieldBuilder<R>;
	build(): BuiltField<UuidField, R>;
}

export interface UriFieldBuilder<R extends CondExpr | undefined = undefined> {
	label(value: string): UriFieldBuilder<R>;
	description(value: string): UriFieldBuilder<R>;
	required(): UriFieldBuilder<true>;
	required(value: undefined): UriFieldBuilder<true>;
	required<const V extends CondExpr>(value: V): UriFieldBuilder<V>;
	visible(value?: CondExpr): UriFieldBuilder<R>;
	minLength(value: number): UriFieldBuilder<R>;
	maxLength(value: number): UriFieldBuilder<R>;
	pattern(value: string): UriFieldBuilder<R>;
	default(value: string): UriFieldBuilder<R>;
	build(): BuiltField<UriField, R>;
}

export interface EnumFieldBuilder<R extends CondExpr | undefined = undefined> {
	label(value: string): EnumFieldBuilder<R>;
	description(value: string): EnumFieldBuilder<R>;
	required(): EnumFieldBuilder<true>;
	required(value: undefined): EnumFieldBuilder<true>;
	required<const V extends CondExpr>(value: V): EnumFieldBuilder<V>;
	visible(value?: CondExpr): EnumFieldBuilder<R>;
	options(values: EnumOption[]): EnumFieldBuilder<R>;
	default(value: EnumOptionValue): EnumFieldBuilder<R>;
	build(): BuiltField<EnumField, R>;
}

export interface DateFieldBuilder<R extends CondExpr | undefined = undefined> {
	label(value: string): DateFieldBuilder<R>;
	description(value: string): DateFieldBuilder<R>;
	required(): DateFieldBuilder<true>;
	required(value: undefined): DateFieldBuilder<true>;
	required<const V extends CondExpr>(value: V): DateFieldBuilder<V>;
	visible(value?: CondExpr): DateFieldBuilder<R>;
	min(value: string): DateFieldBuilder<R>;
	max(value: string): DateFieldBuilder<R>;
	default(value: string): DateFieldBuilder<R>;
	build(): BuiltField<DateField, R>;
}

export interface DatetimeFieldBuilder<R extends CondExpr | undefined = undefined> {
	label(value: string): DatetimeFieldBuilder<R>;
	description(value: string): DatetimeFieldBuilder<R>;
	required(): DatetimeFieldBuilder<true>;
	required(value: undefined): DatetimeFieldBuilder<true>;
	required<const V extends CondExpr>(value: V): DatetimeFieldBuilder<V>;
	visible(value?: CondExpr): DatetimeFieldBuilder<R>;
	min(value: string): DatetimeFieldBuilder<R>;
	max(value: string): DatetimeFieldBuilder<R>;
	default(value: string): DatetimeFieldBuilder<R>;
	build(): BuiltField<DatetimeField, R>;
}

export interface TimeFieldBuilder<R extends CondExpr | undefined = undefined> {
	label(value: string): TimeFieldBuilder<R>;
	description(value: string): TimeFieldBuilder<R>;
	required(): TimeFieldBuilder<true>;
	required(value: undefined): TimeFieldBuilder<true>;
	required<const V extends CondExpr>(value: V): TimeFieldBuilder<V>;
	visible(value?: CondExpr): TimeFieldBuilder<R>;
	min(value: string): TimeFieldBuilder<R>;
	max(value: string): TimeFieldBuilder<R>;
	default(value: string): TimeFieldBuilder<R>;
	build(): BuiltField<TimeField, R>;
}

export interface PersonFieldBuilder<R extends CondExpr | undefined = undefined> {
	label(value: string): PersonFieldBuilder<R>;
	description(value: string): PersonFieldBuilder<R>;
	required(): PersonFieldBuilder<true>;
	required(value: undefined): PersonFieldBuilder<true>;
	required<const V extends CondExpr>(value: V): PersonFieldBuilder<V>;
	visible(value?: CondExpr): PersonFieldBuilder<R>;
	default(value: Person): PersonFieldBuilder<R>;
	build(): BuiltField<PersonField, R>;
}

export interface OrganizationFieldBuilder<R extends CondExpr | undefined = undefined> {
	label(value: string): OrganizationFieldBuilder<R>;
	description(value: string): OrganizationFieldBuilder<R>;
	required(): OrganizationFieldBuilder<true>;
	required(value: undefined): OrganizationFieldBuilder<true>;
	required<const V extends CondExpr>(value: V): OrganizationFieldBuilder<V>;
	visible(value?: CondExpr): OrganizationFieldBuilder<R>;
	default(value: Organization): OrganizationFieldBuilder<R>;
	build(): BuiltField<OrganizationField, R>;
}

export interface IdentificationFieldBuilder<R extends CondExpr | undefined = undefined> {
	label(value: string): IdentificationFieldBuilder<R>;
	description(value: string): IdentificationFieldBuilder<R>;
	required(): IdentificationFieldBuilder<true>;
	required(value: undefined): IdentificationFieldBuilder<true>;
	required<const V extends CondExpr>(value: V): IdentificationFieldBuilder<V>;
	visible(value?: CondExpr): IdentificationFieldBuilder<R>;
	allowedTypes(...types: string[]): IdentificationFieldBuilder<R>;
	default(value: Identification): IdentificationFieldBuilder<R>;
	build(): BuiltField<IdentificationField, R>;
}

export interface MultiselectFieldBuilder<R extends CondExpr | undefined = undefined> {
	label(value: string): MultiselectFieldBuilder<R>;
	description(value: string): MultiselectFieldBuilder<R>;
	required(): MultiselectFieldBuilder<true>;
	required(value: undefined): MultiselectFieldBuilder<true>;
	required<const V extends CondExpr>(value: V): MultiselectFieldBuilder<V>;
	visible(value?: CondExpr): MultiselectFieldBuilder<R>;
	options(values: EnumOption[]): MultiselectFieldBuilder<R>;
	min(value: number): MultiselectFieldBuilder<R>;
	max(value: number): MultiselectFieldBuilder<R>;
	default(value: EnumOptionValue[]): MultiselectFieldBuilder<R>;
	build(): BuiltField<MultiselectField, R>;
}

export interface PercentageFieldBuilder<R extends CondExpr | undefined = undefined> {
	label(value: string): PercentageFieldBuilder<R>;
	description(value: string): PercentageFieldBuilder<R>;
	required(): PercentageFieldBuilder<true>;
	required(value: undefined): PercentageFieldBuilder<true>;
	required<const V extends CondExpr>(value: V): PercentageFieldBuilder<V>;
	visible(value?: CondExpr): PercentageFieldBuilder<R>;
	min(value: number): PercentageFieldBuilder<R>;
	max(value: number): PercentageFieldBuilder<R>;
	precision(value: number): PercentageFieldBuilder<R>;
	default(value: number): PercentageFieldBuilder<R>;
	build(): BuiltField<PercentageField, R>;
}

export interface RatingFieldBuilder<R extends CondExpr | undefined = undefined> {
	label(value: string): RatingFieldBuilder<R>;
	description(value: string): RatingFieldBuilder<R>;
	required(): RatingFieldBuilder<true>;
	required(value: undefined): RatingFieldBuilder<true>;
	required<const V extends CondExpr>(value: V): RatingFieldBuilder<V>;
	visible(value?: CondExpr): RatingFieldBuilder<R>;
	min(value: number): RatingFieldBuilder<R>;
	max(value: number): RatingFieldBuilder<R>;
	step(value: number): RatingFieldBuilder<R>;
	default(value: number): RatingFieldBuilder<R>;
	build(): BuiltField<RatingField, R>;
}

export interface FieldsetFieldBuilder<
	R extends CondExpr | undefined = undefined,
	Fields extends Record<string, FormField> = Record<string, never>,
> {
	label(value: string): FieldsetFieldBuilder<R, Fields>;
	description(value: string): FieldsetFieldBuilder<R, Fields>;
	required(): FieldsetFieldBuilder<true, Fields>;
	required(value: undefined): FieldsetFieldBuilder<true, Fields>;
	required<const V extends CondExpr>(value: V): FieldsetFieldBuilder<V, Fields>;
	visible(value?: CondExpr): FieldsetFieldBuilder<R, Fields>;
	field<const K extends string, const D extends Buildable<FormField>>(
		id: K,
		fieldDef: D,
	): FieldsetFieldBuilder<R, AddFieldDefinition<Fields, K, BuiltFieldDefinition<D>>>;
	fields<const F extends Record<string, Buildable<FormField>>>(
		fieldsObj: F,
	): FieldsetFieldBuilder<
		R,
		{
			[K in keyof F]: BuiltFieldDefinition<F[K]>
		}
	>;
	build(): BuiltField<FieldsetFieldWithFields<Fields>, R>;
}

export interface ListFieldBuilder<
	R extends CondExpr | undefined = undefined,
	Item extends FormField = FormField,
> {
	label(value: string): ListFieldBuilder<R, Item>;
	description(value: string): ListFieldBuilder<R, Item>;
	required(): ListFieldBuilder<true, Item>;
	required(value: undefined): ListFieldBuilder<true, Item>;
	required<const V extends CondExpr>(value: V): ListFieldBuilder<V, Item>;
	visible(value?: CondExpr): ListFieldBuilder<R, Item>;
	item<const D extends Buildable<FormField>>(field: D): ListFieldBuilder<R, BuiltFieldDefinition<D>>;
	minItems(value: number): ListFieldBuilder<R, Item>;
	maxItems(value: number): ListFieldBuilder<R, Item>;
	build(): BuiltField<ListFieldWithItem<Item>, R>;
}

// ============================================================================
// Field Factory Functions
// ============================================================================

export function textField(): TextFieldBuilder {
	const _def: Record<string, unknown> = { type: 'text' };
	const self = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		minLength(value: number) { _def.minLength = value; return self; },
		maxLength(value: number) { _def.maxLength = value; return self; },
		pattern(value: string) { _def.pattern = value; return self; },
		default(value: string) { _def.default = value; return self; },
		build() { return parseField(_def) as TextField; },
	};
	return self as unknown as TextFieldBuilder;
}

export function booleanField(): BooleanFieldBuilder {
	const _def: Record<string, unknown> = { type: 'boolean' };
	const self = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		default(value: boolean) { _def.default = value; return self; },
		build() { return parseField(_def) as BooleanField; },
	};
	return self as unknown as BooleanFieldBuilder;
}

export function numberField(): NumberFieldBuilder {
	const _def: Record<string, unknown> = { type: 'number' };
	const self = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		min(value: number) { _def.min = value; return self; },
		max(value: number) { _def.max = value; return self; },
		default(value: number) { _def.default = value; return self; },
		build() { return parseField(_def) as NumberField; },
	};
	return self as unknown as NumberFieldBuilder;
}

export function coordinateField(): CoordinateFieldBuilder {
	const _def: Record<string, unknown> = { type: 'coordinate' };
	const self = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		default(value: Coordinate) { _def.default = value; return self; },
		build() { return parseField(_def) as CoordinateField; },
	};
	return self as unknown as CoordinateFieldBuilder;
}

export function bboxField(): BboxFieldBuilder {
	const _def: Record<string, unknown> = { type: 'bbox' };
	const self = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		default(value: Bbox) { _def.default = value; return self; },
		build() { return parseField(_def) as BboxField; },
	};
	return self as unknown as BboxFieldBuilder;
}

export function moneyField(): MoneyFieldBuilder {
	const _def: Record<string, unknown> = { type: 'money' };
	const self = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		min(value: number) { _def.min = value; return self; },
		max(value: number) { _def.max = value; return self; },
		default(value: Money) { _def.default = value; return self; },
		build() { return parseField(_def) as MoneyField; },
	};
	return self as unknown as MoneyFieldBuilder;
}

export function addressField(): AddressFieldBuilder {
	const _def: Record<string, unknown> = { type: 'address' };
	const self = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		default(value: Address) { _def.default = value; return self; },
		build() { return parseField(_def) as AddressField; },
	};
	return self as unknown as AddressFieldBuilder;
}

export function phoneField(): PhoneFieldBuilder {
	const _def: Record<string, unknown> = { type: 'phone' };
	const self = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		default(value: Phone) { _def.default = value; return self; },
		build() { return parseField(_def) as PhoneField; },
	};
	return self as unknown as PhoneFieldBuilder;
}

export function durationField(): DurationFieldBuilder {
	const _def: Record<string, unknown> = { type: 'duration' };
	const self = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		default(value: Duration) { _def.default = value; return self; },
		build() { return parseField(_def) as DurationField; },
	};
	return self as unknown as DurationFieldBuilder;
}

export function emailField(): EmailFieldBuilder {
	const _def: Record<string, unknown> = { type: 'email' };
	const self = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		minLength(value: number) { _def.minLength = value; return self; },
		maxLength(value: number) { _def.maxLength = value; return self; },
		pattern(value: string) { _def.pattern = value; return self; },
		default(value: string) { _def.default = value; return self; },
		build() { return parseField(_def) as EmailField; },
	};
	return self as unknown as EmailFieldBuilder;
}

export function uuidField(): UuidFieldBuilder {
	const _def: Record<string, unknown> = { type: 'uuid' };
	const self = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		minLength(value: number) { _def.minLength = value; return self; },
		maxLength(value: number) { _def.maxLength = value; return self; },
		pattern(value: string) { _def.pattern = value; return self; },
		default(value: string) { _def.default = value; return self; },
		build() { return parseField(_def) as UuidField; },
	};
	return self as unknown as UuidFieldBuilder;
}

export function uriField(): UriFieldBuilder {
	const _def: Record<string, unknown> = { type: 'uri' };
	const self = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		minLength(value: number) { _def.minLength = value; return self; },
		maxLength(value: number) { _def.maxLength = value; return self; },
		pattern(value: string) { _def.pattern = value; return self; },
		default(value: string) { _def.default = value; return self; },
		build() { return parseField(_def) as UriField; },
	};
	return self as unknown as UriFieldBuilder;
}

export function enumField(): EnumFieldBuilder {
	const _def: Record<string, unknown> = { type: 'enum' };
	const self = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		options(values: EnumOption[]) { _def.enum = values; return self; },
		default(value: EnumOptionValue) { _def.default = value; return self; },
		build() { return parseField(_def) as EnumField; },
	};
	return self as unknown as EnumFieldBuilder;
}

export function dateField(): DateFieldBuilder {
	const _def: Record<string, unknown> = { type: 'date' };
	const self = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		min(value: string) { _def.min = value; return self; },
		max(value: string) { _def.max = value; return self; },
		default(value: string) { _def.default = value; return self; },
		build() { return parseField(_def) as DateField; },
	};
	return self as unknown as DateFieldBuilder;
}

export function datetimeField(): DatetimeFieldBuilder {
	const _def: Record<string, unknown> = { type: 'datetime' };
	const self = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		min(value: string) { _def.min = value; return self; },
		max(value: string) { _def.max = value; return self; },
		default(value: string) { _def.default = value; return self; },
		build() { return parseField(_def) as DatetimeField; },
	};
	return self as unknown as DatetimeFieldBuilder;
}

export function timeField(): TimeFieldBuilder {
	const _def: Record<string, unknown> = { type: 'time' };
	const self = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		min(value: string) { _def.min = value; return self; },
		max(value: string) { _def.max = value; return self; },
		default(value: string) { _def.default = value; return self; },
		build() { return parseField(_def) as TimeField; },
	};
	return self as unknown as TimeFieldBuilder;
}

export function personField(): PersonFieldBuilder {
	const _def: Record<string, unknown> = { type: 'person' };
	const self = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		default(value: Person) { _def.default = value; return self; },
		build() { return parseField(_def) as PersonField; },
	};
	return self as unknown as PersonFieldBuilder;
}

export function organizationField(): OrganizationFieldBuilder {
	const _def: Record<string, unknown> = { type: 'organization' };
	const self = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		default(value: Organization) { _def.default = value; return self; },
		build() { return parseField(_def) as OrganizationField; },
	};
	return self as unknown as OrganizationFieldBuilder;
}

export function identificationField(): IdentificationFieldBuilder {
	const _def: Record<string, unknown> = { type: 'identification' };
	const self = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		allowedTypes(...types: string[]) { _def.allowedTypes = types; return self; },
		default(value: Identification) { _def.default = value; return self; },
		build() { return parseField(_def) as IdentificationField; },
	};
	return self as unknown as IdentificationFieldBuilder;
}

export function multiselectField(): MultiselectFieldBuilder {
	const _def: Record<string, unknown> = { type: 'multiselect' };
	const self = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		options(values: EnumOption[]) { _def.enum = values; return self; },
		min(value: number) { _def.min = value; return self; },
		max(value: number) { _def.max = value; return self; },
		default(value: EnumOptionValue[]) { _def.default = value; return self; },
		build() { return parseField(_def) as MultiselectField; },
	};
	return self as unknown as MultiselectFieldBuilder;
}

export function percentageField(): PercentageFieldBuilder {
	const _def: Record<string, unknown> = { type: 'percentage' };
	const self = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		min(value: number) { _def.min = value; return self; },
		max(value: number) { _def.max = value; return self; },
		precision(value: number) { _def.precision = value; return self; },
		default(value: number) { _def.default = value; return self; },
		build() { return parseField(_def) as PercentageField; },
	};
	return self as unknown as PercentageFieldBuilder;
}

export function ratingField(): RatingFieldBuilder {
	const _def: Record<string, unknown> = { type: 'rating' };
	const self = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		min(value: number) { _def.min = value; return self; },
		max(value: number) { _def.max = value; return self; },
		step(value: number) { _def.step = value; return self; },
		default(value: number) { _def.default = value; return self; },
		build() { return parseField(_def) as RatingField; },
	};
	return self as unknown as RatingFieldBuilder;
}

export function fieldsetField(): FieldsetFieldBuilder {
	const _def: Record<string, unknown> = { type: 'fieldset', fields: {} };
	const self = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		field(fieldId: string, fieldDef: Buildable<FormField>) {
			const fields = { ...((_def.fields as Record<string, Buildable<FormField>>) || {}) };
			fields[fieldId] = fieldDef;
			_def.fields = fields;
			return self;
		},
		fields(fieldsObj: Record<string, Buildable<FormField>>) {
			_def.fields = { ...fieldsObj };
			return self;
		},
		build() {
			const fields = Object.fromEntries(
				Object.entries((_def.fields as Record<string, Buildable<FormField>>) || {}).map(([id, fieldDef]) => [
					id,
					resolveFieldDefinition(fieldDef),
				]),
			);
			return parseField({ ..._def, fields }) as FieldsetField;
		},
	};
	return self as unknown as FieldsetFieldBuilder;
}

export function listField(): ListFieldBuilder {
	const _def: Record<string, unknown> = { type: 'list' };
	const self = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		item(value: Buildable<FormField>) { _def.item = value; return self; },
		minItems(value: number) { _def.minItems = value; return self; },
		maxItems(value: number) { _def.maxItems = value; return self; },
		build() {
			const item = _def.item as Buildable<FormField> | undefined;
			return parseField(item === undefined ? _def : { ..._def, item: resolveFieldDefinition(item) }) as ListField;
		},
	};
	return self as unknown as ListFieldBuilder;
}

// ============================================================================
// Field API
// ============================================================================

export type FieldAPI = {
	(): TextFieldBuilder;
	(input: FormField): FormField;
	text(): TextFieldBuilder;
	boolean(): BooleanFieldBuilder;
	number(): NumberFieldBuilder;
	coordinate(): CoordinateFieldBuilder;
	bbox(): BboxFieldBuilder;
	money(): MoneyFieldBuilder;
	address(): AddressFieldBuilder;
	phone(): PhoneFieldBuilder;
	duration(): DurationFieldBuilder;
	email(): EmailFieldBuilder;
	uuid(): UuidFieldBuilder;
	uri(): UriFieldBuilder;
	enum(): EnumFieldBuilder;
	date(): DateFieldBuilder;
	datetime(): DatetimeFieldBuilder;
	time(): TimeFieldBuilder;
	person(): PersonFieldBuilder;
	organization(): OrganizationFieldBuilder;
	identification(): IdentificationFieldBuilder;
	multiselect(): MultiselectFieldBuilder;
	percentage(): PercentageFieldBuilder;
	rating(): RatingFieldBuilder;
	fieldset(): FieldsetFieldBuilder;
	list(): ListFieldBuilder;
	parse(input: unknown): FormField;
	safeParse(input: unknown): { success: true; data: FormField } | { success: false; error: Error };
};

function fieldImpl(): TextFieldBuilder;
function fieldImpl(input: FormField): FormField;
function fieldImpl(input?: FormField): TextFieldBuilder | FormField {
	if (input !== undefined) {
		return parseField(input);
	}
	return textField();
}

export const field: FieldAPI = Object.assign(fieldImpl, {
	text: textField,
	boolean: booleanField,
	number: numberField,
	coordinate: coordinateField,
	bbox: bboxField,
	money: moneyField,
	address: addressField,
	phone: phoneField,
	duration: durationField,
	email: emailField,
	uuid: uuidField,
	uri: uriField,
	enum: enumField,
	date: dateField,
	datetime: datetimeField,
	time: timeField,
	person: personField,
	organization: organizationField,
	identification: identificationField,
	multiselect: multiselectField,
	percentage: percentageField,
	rating: ratingField,
	fieldset: fieldsetField,
	list: listField,
	parse: parseField,
	safeParse: (input: unknown): { success: true; data: FormField } | { success: false; error: Error } => {
		try {
			return { success: true, data: parseField(input) };
		} catch (err) {
			return { success: false, error: err as Error };
		}
	},
});
