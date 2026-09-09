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
import {
	AddressSchema,
	BboxSchema,
	CoordinateSchema,
	DurationSchema,
	IdentificationSchema,
	MoneySchema,
	OrganizationSchema,
	PersonSchema,
	PhoneSchema,
} from "@paradoc/schemas";

// ---------------------------------------------------------------------------
// Shared sub-schemas
// ---------------------------------------------------------------------------

/** A selectable option for enum-style components. */
export const optionSchema = z.object({
	label: z.string(),
	value: z.union([z.string(), z.number()]),
}).strict();
export type CatalogOption = z.infer<typeof optionSchema>;

/**
 * Component props are a closed contract.  Canonical value objects nested in
 * these props deliberately keep the unknown-key policy of their source
 * schemas; only the UI component boundary is closed here.
 */
const catalogObject = <T extends z.ZodRawShape>(shape: T) =>
	z.object(shape).strict();

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

const textInputProps = catalogObject({
	...baseInputProps,
	placeholder: z.string().optional(),
	default: z.string().optional(),
	minLength: z.number().optional(),
	maxLength: z.number().optional(),
	pattern: z.string().optional(),
});

const textAreaProps = catalogObject({
	...baseInputProps,
	placeholder: z.string().optional(),
	default: z.string().optional(),
	minLength: z.number().optional(),
	maxLength: z.number().optional(),
	pattern: z.string().optional(),
	rows: z.number().optional(),
});

const numberInputProps = catalogObject({
	...baseInputProps,
	default: z.number().optional(),
	min: z.number().optional(),
	max: z.number().optional(),
	step: z.number().optional(),
});

const moneyInputProps = catalogObject({
	...baseInputProps,
	default: MoneySchema.optional(),
	min: z.number().optional(),
	max: z.number().optional(),
	defaultCurrency: z.string().optional(),
});

const percentageInputProps = catalogObject({
	...baseInputProps,
	default: z.number().optional(),
	min: z.number().optional(),
	max: z.number().optional(),
	precision: z.number().optional(),
});

const coordinateInputProps = catalogObject({
	...baseInputProps,
	default: CoordinateSchema.optional(),
});

const bboxInputProps = catalogObject({
	...baseInputProps,
	default: BboxSchema.optional(),
});

const yesNoToggleProps = catalogObject({
	...baseInputProps,
	default: z.boolean().optional(),
	yesLabel: z.string().optional(),
	noLabel: z.string().optional(),
});

const enumPickerProps = catalogObject({
	...baseInputProps,
	options: z.array(optionSchema),
	default: z.union([z.string(), z.number()]).optional(),
	/** "radio" or "dropdown". Mapper picks; consumer can override. */
	display: z.enum(["radio", "dropdown"]).optional(),
});

const multiSelectChipsProps = catalogObject({
	...baseInputProps,
	options: z.array(optionSchema),
	default: z.array(z.union([z.string(), z.number()])).optional(),
	min: z.number().optional(),
	max: z.number().optional(),
});

const dateInputProps = catalogObject({
	...baseInputProps,
	/** ISO 8601 date (YYYY-MM-DD). */
	default: z.string().optional(),
	min: z.string().optional(),
	max: z.string().optional(),
});

const dateTimeInputProps = catalogObject({
	...baseInputProps,
	/** ISO 8601 datetime. */
	default: z.string().optional(),
	min: z.string().optional(),
	max: z.string().optional(),
});

const timeInputProps = catalogObject({
	...baseInputProps,
	/** HH:MM:SS. */
	default: z.string().optional(),
	min: z.string().optional(),
	max: z.string().optional(),
});

const durationInputProps = catalogObject({
	...baseInputProps,
	default: DurationSchema.optional(),
});

const emailInputProps = catalogObject({
	...baseInputProps,
	placeholder: z.string().optional(),
	default: z.string().optional(),
	minLength: z.number().optional(),
	maxLength: z.number().optional(),
});

const phoneInputProps = catalogObject({
	...baseInputProps,
	default: PhoneSchema.optional(),
});

const uriInputProps = catalogObject({
	...baseInputProps,
	placeholder: z.string().optional(),
	default: z.string().optional(),
	minLength: z.number().optional(),
	maxLength: z.number().optional(),
	pattern: z.string().optional(),
});

const addressFormProps = catalogObject({
	...baseInputProps,
	default: AddressSchema.optional(),
});

const personFormProps = catalogObject({
	...baseInputProps,
	default: PersonSchema.optional(),
});

const organizationFormProps = catalogObject({
	...baseInputProps,
	default: OrganizationSchema.optional(),
});

const identificationInputProps = catalogObject({
	...baseInputProps,
	default: IdentificationSchema.optional(),
	allowedTypes: z.array(z.string()).optional(),
});

const ratingStarsProps = catalogObject({
	...baseInputProps,
	default: z.number().optional(),
	min: z.number().optional(),
	max: z.number().optional(),
	step: z.number().optional(),
});

const fieldsetProps = catalogObject({
	...baseInputProps,
});

const listProps = catalogObject({
	...baseInputProps,
	minItems: z.number().int().nonnegative().optional(),
	maxItems: z.number().int().nonnegative().optional(),
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
	CoordinateInput: { props: coordinateInputProps },
	BboxInput: { props: bboxInputProps },
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
	List: { props: listProps },
} as const;

export type CatalogComponentName = keyof typeof CATALOG;

/** Props accepted by each catalog component, keyed by component identity. */
export type CatalogProps = {
	[TName in CatalogComponentName]: z.infer<(typeof CATALOG)[TName]["props"]>;
};

/** Props accepted by one named catalog component. */
export type CatalogPropsFor<TName extends CatalogComponentName> =
	CatalogProps[TName];

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
