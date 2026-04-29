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

// Condition expression type (boolean or string expression)
type CondExpr = boolean | string;

// ============================================================================
// Validation
// ============================================================================

function parseField(input: unknown): FormField {
	return parseFormField(input);
}

// ============================================================================
// Field Builder Types (for external use)
// ============================================================================

export interface TextFieldBuilder {
	label(value: string): TextFieldBuilder;
	description(value: string): TextFieldBuilder;
	required(value?: CondExpr): TextFieldBuilder;
	visible(value?: CondExpr): TextFieldBuilder;
	minLength(value: number): TextFieldBuilder;
	maxLength(value: number): TextFieldBuilder;
	pattern(value: string): TextFieldBuilder;
	default(value: string): TextFieldBuilder;
	build(): TextField;
}

export interface BooleanFieldBuilder {
	label(value: string): BooleanFieldBuilder;
	description(value: string): BooleanFieldBuilder;
	required(value?: CondExpr): BooleanFieldBuilder;
	visible(value?: CondExpr): BooleanFieldBuilder;
	default(value: boolean): BooleanFieldBuilder;
	build(): BooleanField;
}

export interface NumberFieldBuilder {
	label(value: string): NumberFieldBuilder;
	description(value: string): NumberFieldBuilder;
	required(value?: CondExpr): NumberFieldBuilder;
	visible(value?: CondExpr): NumberFieldBuilder;
	min(value: number): NumberFieldBuilder;
	max(value: number): NumberFieldBuilder;
	default(value: number): NumberFieldBuilder;
	build(): NumberField;
}

export interface CoordinateFieldBuilder {
	label(value: string): CoordinateFieldBuilder;
	description(value: string): CoordinateFieldBuilder;
	required(value?: CondExpr): CoordinateFieldBuilder;
	visible(value?: CondExpr): CoordinateFieldBuilder;
	default(value: Coordinate): CoordinateFieldBuilder;
	build(): CoordinateField;
}

export interface BboxFieldBuilder {
	label(value: string): BboxFieldBuilder;
	description(value: string): BboxFieldBuilder;
	required(value?: CondExpr): BboxFieldBuilder;
	visible(value?: CondExpr): BboxFieldBuilder;
	default(value: Bbox): BboxFieldBuilder;
	build(): BboxField;
}

export interface MoneyFieldBuilder {
	label(value: string): MoneyFieldBuilder;
	description(value: string): MoneyFieldBuilder;
	required(value?: CondExpr): MoneyFieldBuilder;
	visible(value?: CondExpr): MoneyFieldBuilder;
	min(value: number): MoneyFieldBuilder;
	max(value: number): MoneyFieldBuilder;
	default(value: Money): MoneyFieldBuilder;
	build(): MoneyField;
}

export interface AddressFieldBuilder {
	label(value: string): AddressFieldBuilder;
	description(value: string): AddressFieldBuilder;
	required(value?: CondExpr): AddressFieldBuilder;
	visible(value?: CondExpr): AddressFieldBuilder;
	default(value: Address): AddressFieldBuilder;
	build(): AddressField;
}

export interface PhoneFieldBuilder {
	label(value: string): PhoneFieldBuilder;
	description(value: string): PhoneFieldBuilder;
	required(value?: CondExpr): PhoneFieldBuilder;
	visible(value?: CondExpr): PhoneFieldBuilder;
	default(value: Phone): PhoneFieldBuilder;
	build(): PhoneField;
}

export interface DurationFieldBuilder {
	label(value: string): DurationFieldBuilder;
	description(value: string): DurationFieldBuilder;
	required(value?: CondExpr): DurationFieldBuilder;
	visible(value?: CondExpr): DurationFieldBuilder;
	default(value: Duration): DurationFieldBuilder;
	build(): DurationField;
}

export interface EmailFieldBuilder {
	label(value: string): EmailFieldBuilder;
	description(value: string): EmailFieldBuilder;
	required(value?: CondExpr): EmailFieldBuilder;
	visible(value?: CondExpr): EmailFieldBuilder;
	minLength(value: number): EmailFieldBuilder;
	maxLength(value: number): EmailFieldBuilder;
	pattern(value: string): EmailFieldBuilder;
	default(value: string): EmailFieldBuilder;
	build(): EmailField;
}

export interface UuidFieldBuilder {
	label(value: string): UuidFieldBuilder;
	description(value: string): UuidFieldBuilder;
	required(value?: CondExpr): UuidFieldBuilder;
	visible(value?: CondExpr): UuidFieldBuilder;
	minLength(value: number): UuidFieldBuilder;
	maxLength(value: number): UuidFieldBuilder;
	pattern(value: string): UuidFieldBuilder;
	default(value: string): UuidFieldBuilder;
	build(): UuidField;
}

export interface UriFieldBuilder {
	label(value: string): UriFieldBuilder;
	description(value: string): UriFieldBuilder;
	required(value?: CondExpr): UriFieldBuilder;
	visible(value?: CondExpr): UriFieldBuilder;
	minLength(value: number): UriFieldBuilder;
	maxLength(value: number): UriFieldBuilder;
	pattern(value: string): UriFieldBuilder;
	default(value: string): UriFieldBuilder;
	build(): UriField;
}

export interface EnumFieldBuilder {
	label(value: string): EnumFieldBuilder;
	description(value: string): EnumFieldBuilder;
	required(value?: CondExpr): EnumFieldBuilder;
	visible(value?: CondExpr): EnumFieldBuilder;
	options(values: (string | number)[]): EnumFieldBuilder;
	default(value: string | number): EnumFieldBuilder;
	build(): EnumField;
}

export interface DateFieldBuilder {
	label(value: string): DateFieldBuilder;
	description(value: string): DateFieldBuilder;
	required(value?: CondExpr): DateFieldBuilder;
	visible(value?: CondExpr): DateFieldBuilder;
	min(value: string): DateFieldBuilder;
	max(value: string): DateFieldBuilder;
	default(value: string): DateFieldBuilder;
	build(): DateField;
}

export interface DatetimeFieldBuilder {
	label(value: string): DatetimeFieldBuilder;
	description(value: string): DatetimeFieldBuilder;
	required(value?: CondExpr): DatetimeFieldBuilder;
	visible(value?: CondExpr): DatetimeFieldBuilder;
	min(value: string): DatetimeFieldBuilder;
	max(value: string): DatetimeFieldBuilder;
	default(value: string): DatetimeFieldBuilder;
	build(): DatetimeField;
}

export interface TimeFieldBuilder {
	label(value: string): TimeFieldBuilder;
	description(value: string): TimeFieldBuilder;
	required(value?: CondExpr): TimeFieldBuilder;
	visible(value?: CondExpr): TimeFieldBuilder;
	min(value: string): TimeFieldBuilder;
	max(value: string): TimeFieldBuilder;
	default(value: string): TimeFieldBuilder;
	build(): TimeField;
}

export interface PersonFieldBuilder {
	label(value: string): PersonFieldBuilder;
	description(value: string): PersonFieldBuilder;
	required(value?: CondExpr): PersonFieldBuilder;
	visible(value?: CondExpr): PersonFieldBuilder;
	default(value: Person): PersonFieldBuilder;
	build(): PersonField;
}

export interface OrganizationFieldBuilder {
	label(value: string): OrganizationFieldBuilder;
	description(value: string): OrganizationFieldBuilder;
	required(value?: CondExpr): OrganizationFieldBuilder;
	visible(value?: CondExpr): OrganizationFieldBuilder;
	default(value: Organization): OrganizationFieldBuilder;
	build(): OrganizationField;
}

export interface IdentificationFieldBuilder {
	label(value: string): IdentificationFieldBuilder;
	description(value: string): IdentificationFieldBuilder;
	required(value?: CondExpr): IdentificationFieldBuilder;
	visible(value?: CondExpr): IdentificationFieldBuilder;
	allowedTypes(...types: string[]): IdentificationFieldBuilder;
	default(value: Identification): IdentificationFieldBuilder;
	build(): IdentificationField;
}

export interface MultiselectFieldBuilder {
	label(value: string): MultiselectFieldBuilder;
	description(value: string): MultiselectFieldBuilder;
	required(value?: CondExpr): MultiselectFieldBuilder;
	visible(value?: CondExpr): MultiselectFieldBuilder;
	options(values: (string | number)[]): MultiselectFieldBuilder;
	min(value: number): MultiselectFieldBuilder;
	max(value: number): MultiselectFieldBuilder;
	default(value: (string | number)[]): MultiselectFieldBuilder;
	build(): MultiselectField;
}

export interface PercentageFieldBuilder {
	label(value: string): PercentageFieldBuilder;
	description(value: string): PercentageFieldBuilder;
	required(value?: CondExpr): PercentageFieldBuilder;
	visible(value?: CondExpr): PercentageFieldBuilder;
	min(value: number): PercentageFieldBuilder;
	max(value: number): PercentageFieldBuilder;
	precision(value: number): PercentageFieldBuilder;
	default(value: number): PercentageFieldBuilder;
	build(): PercentageField;
}

export interface RatingFieldBuilder {
	label(value: string): RatingFieldBuilder;
	description(value: string): RatingFieldBuilder;
	required(value?: CondExpr): RatingFieldBuilder;
	visible(value?: CondExpr): RatingFieldBuilder;
	min(value: number): RatingFieldBuilder;
	max(value: number): RatingFieldBuilder;
	step(value: number): RatingFieldBuilder;
	default(value: number): RatingFieldBuilder;
	build(): RatingField;
}

export interface FieldsetFieldBuilder {
	label(value: string): FieldsetFieldBuilder;
	description(value: string): FieldsetFieldBuilder;
	required(value?: CondExpr): FieldsetFieldBuilder;
	visible(value?: CondExpr): FieldsetFieldBuilder;
	fields(fieldsObj: Record<string, FormField>): FieldsetFieldBuilder;
	build(): FieldsetField;
}

// ============================================================================
// Field Factory Functions
// ============================================================================

export function textField(): TextFieldBuilder {
	const _def: Record<string, unknown> = { type: 'text' };
	const self: TextFieldBuilder = {
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
	return self;
}

export function booleanField(): BooleanFieldBuilder {
	const _def: Record<string, unknown> = { type: 'boolean' };
	const self: BooleanFieldBuilder = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		default(value: boolean) { _def.default = value; return self; },
		build() { return parseField(_def) as BooleanField; },
	};
	return self;
}

export function numberField(): NumberFieldBuilder {
	const _def: Record<string, unknown> = { type: 'number' };
	const self: NumberFieldBuilder = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		min(value: number) { _def.min = value; return self; },
		max(value: number) { _def.max = value; return self; },
		default(value: number) { _def.default = value; return self; },
		build() { return parseField(_def) as NumberField; },
	};
	return self;
}

export function coordinateField(): CoordinateFieldBuilder {
	const _def: Record<string, unknown> = { type: 'coordinate' };
	const self: CoordinateFieldBuilder = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		default(value: Coordinate) { _def.default = value; return self; },
		build() { return parseField(_def) as CoordinateField; },
	};
	return self;
}

export function bboxField(): BboxFieldBuilder {
	const _def: Record<string, unknown> = { type: 'bbox' };
	const self: BboxFieldBuilder = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		default(value: Bbox) { _def.default = value; return self; },
		build() { return parseField(_def) as BboxField; },
	};
	return self;
}

export function moneyField(): MoneyFieldBuilder {
	const _def: Record<string, unknown> = { type: 'money' };
	const self: MoneyFieldBuilder = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		min(value: number) { _def.min = value; return self; },
		max(value: number) { _def.max = value; return self; },
		default(value: Money) { _def.default = value; return self; },
		build() { return parseField(_def) as MoneyField; },
	};
	return self;
}

export function addressField(): AddressFieldBuilder {
	const _def: Record<string, unknown> = { type: 'address' };
	const self: AddressFieldBuilder = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		default(value: Address) { _def.default = value; return self; },
		build() { return parseField(_def) as AddressField; },
	};
	return self;
}

export function phoneField(): PhoneFieldBuilder {
	const _def: Record<string, unknown> = { type: 'phone' };
	const self: PhoneFieldBuilder = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		default(value: Phone) { _def.default = value; return self; },
		build() { return parseField(_def) as PhoneField; },
	};
	return self;
}

export function durationField(): DurationFieldBuilder {
	const _def: Record<string, unknown> = { type: 'duration' };
	const self: DurationFieldBuilder = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		default(value: Duration) { _def.default = value; return self; },
		build() { return parseField(_def) as DurationField; },
	};
	return self;
}

export function emailField(): EmailFieldBuilder {
	const _def: Record<string, unknown> = { type: 'email' };
	const self: EmailFieldBuilder = {
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
	return self;
}

export function uuidField(): UuidFieldBuilder {
	const _def: Record<string, unknown> = { type: 'uuid' };
	const self: UuidFieldBuilder = {
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
	return self;
}

export function uriField(): UriFieldBuilder {
	const _def: Record<string, unknown> = { type: 'uri' };
	const self: UriFieldBuilder = {
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
	return self;
}

export function enumField(): EnumFieldBuilder {
	const _def: Record<string, unknown> = { type: 'enum' };
	const self: EnumFieldBuilder = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		options(values: (string | number)[]) { _def.enum = values; return self; },
		default(value: string | number) { _def.default = value; return self; },
		build() { return parseField(_def) as EnumField; },
	};
	return self;
}

export function dateField(): DateFieldBuilder {
	const _def: Record<string, unknown> = { type: 'date' };
	const self: DateFieldBuilder = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		min(value: string) { _def.min = value; return self; },
		max(value: string) { _def.max = value; return self; },
		default(value: string) { _def.default = value; return self; },
		build() { return parseField(_def) as DateField; },
	};
	return self;
}

export function datetimeField(): DatetimeFieldBuilder {
	const _def: Record<string, unknown> = { type: 'datetime' };
	const self: DatetimeFieldBuilder = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		min(value: string) { _def.min = value; return self; },
		max(value: string) { _def.max = value; return self; },
		default(value: string) { _def.default = value; return self; },
		build() { return parseField(_def) as DatetimeField; },
	};
	return self;
}

export function timeField(): TimeFieldBuilder {
	const _def: Record<string, unknown> = { type: 'time' };
	const self: TimeFieldBuilder = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		min(value: string) { _def.min = value; return self; },
		max(value: string) { _def.max = value; return self; },
		default(value: string) { _def.default = value; return self; },
		build() { return parseField(_def) as TimeField; },
	};
	return self;
}

export function personField(): PersonFieldBuilder {
	const _def: Record<string, unknown> = { type: 'person' };
	const self: PersonFieldBuilder = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		default(value: Person) { _def.default = value; return self; },
		build() { return parseField(_def) as PersonField; },
	};
	return self;
}

export function organizationField(): OrganizationFieldBuilder {
	const _def: Record<string, unknown> = { type: 'organization' };
	const self: OrganizationFieldBuilder = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		default(value: Organization) { _def.default = value; return self; },
		build() { return parseField(_def) as OrganizationField; },
	};
	return self;
}

export function identificationField(): IdentificationFieldBuilder {
	const _def: Record<string, unknown> = { type: 'identification' };
	const self: IdentificationFieldBuilder = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		allowedTypes(...types: string[]) { _def.allowedTypes = types; return self; },
		default(value: Identification) { _def.default = value; return self; },
		build() { return parseField(_def) as IdentificationField; },
	};
	return self;
}

export function multiselectField(): MultiselectFieldBuilder {
	const _def: Record<string, unknown> = { type: 'multiselect' };
	const self: MultiselectFieldBuilder = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		options(values: (string | number)[]) { _def.enum = values; return self; },
		min(value: number) { _def.min = value; return self; },
		max(value: number) { _def.max = value; return self; },
		default(value: (string | number)[]) { _def.default = value; return self; },
		build() { return parseField(_def) as MultiselectField; },
	};
	return self;
}

export function percentageField(): PercentageFieldBuilder {
	const _def: Record<string, unknown> = { type: 'percentage' };
	const self: PercentageFieldBuilder = {
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
	return self;
}

export function ratingField(): RatingFieldBuilder {
	const _def: Record<string, unknown> = { type: 'rating' };
	const self: RatingFieldBuilder = {
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
	return self;
}

export function fieldsetField(): FieldsetFieldBuilder {
	const _def: Record<string, unknown> = { type: 'fieldset', fields: {} };
	const self: FieldsetFieldBuilder = {
		label(value: string) { _def.label = value; return self; },
		description(value: string) { _def.description = value; return self; },
		required(value: CondExpr = true) { _def.required = value; return self; },
		visible(value: CondExpr = true) { _def.visible = value; return self; },
		fields(fieldsObj: Record<string, FormField>) {
			// Parse nested fields recursively
			const parsedFields: Record<string, FormField> = {};
			for (const [id, fieldDef] of Object.entries(fieldsObj)) {
				parsedFields[id] = parseField(fieldDef);
			}
			_def.fields = parsedFields;
			return self;
		},
		build() { return parseField(_def) as FieldsetField; },
	};
	return self;
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
	parse: parseField,
	safeParse: (input: unknown): { success: true; data: FormField } | { success: false; error: Error } => {
		try {
			return { success: true, data: parseField(input) };
		} catch (err) {
			return { success: false, error: err as Error };
		}
	},
});
