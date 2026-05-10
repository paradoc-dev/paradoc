/**
 * Catalog of input UI primitives for Paradoc artifacts.
 *
 * The catalog defines the *contract* between the mapper (which produces
 * spec fragments from artifact field definitions) and consumer registries
 * (which provide actual React/Vue/etc. implementations).
 *
 * Each entry's `props` Zod schema describes what props the registry's
 * component will receive. The schemas double as runtime validators when
 * needed.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared sub-schemas
// ---------------------------------------------------------------------------

/** A selectable option for enum-style components. */
export const optionSchema = z.object({
	label: z.string(),
	value: z.union([z.string(), z.number()]),
});
export type CatalogOption = z.infer<typeof optionSchema>;

/** Money default value (matches @paradoc/types' Money primitive). */
const moneyDefaultSchema = z.object({
	amount: z.number(),
	currency: z.string(),
});

/** Address default value (loose; matches @paradoc/types' Address shape). */
const addressDefaultSchema = z.object({
	line1: z.string().optional(),
	line2: z.string().optional(),
	city: z.string().optional(),
	region: z.string().optional(),
	postalCode: z.string().optional(),
	country: z.string().optional(),
});

/** Person default value. */
const personDefaultSchema = z.object({
	firstName: z.string().optional(),
	middleName: z.string().optional(),
	lastName: z.string().optional(),
	suffix: z.string().optional(),
});

/** Organization default value. */
const organizationDefaultSchema = z.object({
	name: z.string().optional(),
	ein: z.string().optional(),
});

/** Phone default value. */
const phoneDefaultSchema = z.object({
	countryCode: z.string().optional(),
	number: z.string().optional(),
});

/** Identification default value. */
const identificationDefaultSchema = z.object({
	type: z.string().optional(),
	number: z.string().optional(),
});

/** Duration default value. */
const durationDefaultSchema = z.object({
	years: z.number().optional(),
	months: z.number().optional(),
	days: z.number().optional(),
	hours: z.number().optional(),
	minutes: z.number().optional(),
	seconds: z.number().optional(),
});

// ---------------------------------------------------------------------------
// Common props every input shares
// ---------------------------------------------------------------------------

const baseInputProps = {
	label: z.string().optional(),
	description: z.string().optional(),
	required: z.boolean().optional(),
};

// ---------------------------------------------------------------------------
// Per-component prop schemas
// ---------------------------------------------------------------------------

const textInputProps = z.object({
	...baseInputProps,
	placeholder: z.string().optional(),
	default: z.string().optional(),
	minLength: z.number().optional(),
	maxLength: z.number().optional(),
	pattern: z.string().optional(),
});

const textAreaProps = z.object({
	...baseInputProps,
	placeholder: z.string().optional(),
	default: z.string().optional(),
	minLength: z.number().optional(),
	maxLength: z.number().optional(),
	rows: z.number().optional(),
});

const numberInputProps = z.object({
	...baseInputProps,
	default: z.number().optional(),
	min: z.number().optional(),
	max: z.number().optional(),
	step: z.number().optional(),
});

const moneyInputProps = z.object({
	...baseInputProps,
	default: moneyDefaultSchema.optional(),
	min: z.number().optional(),
	max: z.number().optional(),
	defaultCurrency: z.string().optional(),
});

const percentageInputProps = z.object({
	...baseInputProps,
	default: z.number().optional(),
	min: z.number().optional(),
	max: z.number().optional(),
	precision: z.number().optional(),
});

const yesNoToggleProps = z.object({
	...baseInputProps,
	default: z.boolean().optional(),
	yesLabel: z.string().optional(),
	noLabel: z.string().optional(),
});

const enumPickerProps = z.object({
	...baseInputProps,
	options: z.array(optionSchema),
	default: z.union([z.string(), z.number()]).optional(),
	/** "radio" or "dropdown". Mapper picks; consumer can override. */
	display: z.enum(["radio", "dropdown"]).optional(),
});

const multiSelectChipsProps = z.object({
	...baseInputProps,
	options: z.array(optionSchema),
	default: z.array(z.union([z.string(), z.number()])).optional(),
	min: z.number().optional(),
	max: z.number().optional(),
});

const dateInputProps = z.object({
	...baseInputProps,
	/** ISO 8601 date (YYYY-MM-DD). */
	default: z.string().optional(),
	min: z.string().optional(),
	max: z.string().optional(),
});

const dateTimeInputProps = z.object({
	...baseInputProps,
	/** ISO 8601 datetime. */
	default: z.string().optional(),
	min: z.string().optional(),
	max: z.string().optional(),
});

const timeInputProps = z.object({
	...baseInputProps,
	/** HH:MM:SS. */
	default: z.string().optional(),
	min: z.string().optional(),
	max: z.string().optional(),
});

const durationInputProps = z.object({
	...baseInputProps,
	default: durationDefaultSchema.optional(),
});

const emailInputProps = z.object({
	...baseInputProps,
	placeholder: z.string().optional(),
	default: z.string().optional(),
	minLength: z.number().optional(),
	maxLength: z.number().optional(),
});

const phoneInputProps = z.object({
	...baseInputProps,
	default: phoneDefaultSchema.optional(),
	defaultCountryCode: z.string().optional(),
});

const uriInputProps = z.object({
	...baseInputProps,
	placeholder: z.string().optional(),
	default: z.string().optional(),
	minLength: z.number().optional(),
	maxLength: z.number().optional(),
	pattern: z.string().optional(),
});

const addressFormProps = z.object({
	...baseInputProps,
	default: addressDefaultSchema.optional(),
});

const personFormProps = z.object({
	...baseInputProps,
	default: personDefaultSchema.optional(),
});

const organizationFormProps = z.object({
	...baseInputProps,
	default: organizationDefaultSchema.optional(),
});

const identificationInputProps = z.object({
	...baseInputProps,
	default: identificationDefaultSchema.optional(),
	allowedTypes: z.array(z.string()).optional(),
});

const ratingStarsProps = z.object({
	...baseInputProps,
	default: z.number().optional(),
	min: z.number().optional(),
	max: z.number().optional(),
	step: z.number().optional(),
});

const fieldsetProps = z.object({
	...baseInputProps,
});

// ---------------------------------------------------------------------------
// The catalog
// ---------------------------------------------------------------------------

/**
 * The master catalog. Maps catalog component names to their prop schemas.
 *
 * Add a new component by extending this record + adding its prop schema
 * above. The mapper (`fieldToSpec`) and consumer registries must stay in
 * sync with this list.
 */
export const CATALOG = {
	TextInput: { props: textInputProps },
	TextArea: { props: textAreaProps },
	NumberInput: { props: numberInputProps },
	MoneyInput: { props: moneyInputProps },
	PercentageInput: { props: percentageInputProps },
	YesNoToggle: { props: yesNoToggleProps },
	EnumPicker: { props: enumPickerProps },
	MultiSelectChips: { props: multiSelectChipsProps },
	DateInput: { props: dateInputProps },
	DateTimeInput: { props: dateTimeInputProps },
	TimeInput: { props: timeInputProps },
	DurationInput: { props: durationInputProps },
	EmailInput: { props: emailInputProps },
	PhoneInput: { props: phoneInputProps },
	UriInput: { props: uriInputProps },
	AddressForm: { props: addressFormProps },
	PersonForm: { props: personFormProps },
	OrganizationForm: { props: organizationFormProps },
	IdentificationInput: { props: identificationInputProps },
	RatingStars: { props: ratingStarsProps },
	Fieldset: { props: fieldsetProps },
} as const;

export type CatalogComponentName = keyof typeof CATALOG;

/** All component names as a runtime-iterable array. */
export const CATALOG_COMPONENT_NAMES = Object.keys(CATALOG) as CatalogComponentName[];

/**
 * Validates a spec node's `props` against the catalog schema for its `type`.
 * Useful for tests and for consumer registries that want runtime validation.
 *
 * Returns the parsed props on success; throws ZodError on failure.
 */
export function validateProps<TName extends CatalogComponentName>(
	name: TName,
	props: unknown,
): z.infer<(typeof CATALOG)[TName]["props"]> {
	return CATALOG[name].props.parse(props) as z.infer<
		(typeof CATALOG)[TName]["props"]
	>;
}
