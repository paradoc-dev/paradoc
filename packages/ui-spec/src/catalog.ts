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
	CurrencyCodeSchema,
	DurationSchema,
	IdentificationSchema,
	MoneySchema,
	OrganizationSchema,
	PersonSchema,
	PhoneSchema,
	FormFieldSchema,
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

/**
 * Keep presentation constraints aligned with the canonical field schemas.
 * The mapper uses the same property names for field-backed props, so a small
 * synthetic field lets the source schema remain the single validation owner.
 */
const fieldBackedProps = <T extends z.ZodRawShape>(
	shape: T,
	toField: (props: z.output<z.ZodObject<T>>) => unknown,
) =>
	catalogObject(shape).superRefine((props, ctx) => {
		const result = FormFieldSchema.safeParse(toField(props));
		if (result.success) return;
		for (const issue of result.error.issues) {
			ctx.addIssue({ ...issue, path: issue.path });
		}
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

const textInputShape = {
	...baseInputProps,
	placeholder: z.string().optional(),
	default: z.string().optional(),
	minLength: z.number().optional(),
	maxLength: z.number().optional(),
	pattern: z.string().optional(),
};

const textField = (props: z.output<z.ZodObject<typeof textInputShape>>) => ({
	type: "text" as const,
	label: props.label,
	description: props.description,
	required: props.required,
	default: props.default,
	minLength: props.minLength,
	maxLength: props.maxLength,
	pattern: props.pattern,
});

const textInputProps = fieldBackedProps(textInputShape, textField);

const textAreaProps = fieldBackedProps({
	...textInputShape,
	rows: z.number().optional(),
}, textField);

const numberInputProps = fieldBackedProps({
	...baseInputProps,
	default: z.number().optional(),
	min: z.number().optional(),
	max: z.number().optional(),
	step: z.number().optional(),
}, (props) => ({ type: "number", ...props }));

const moneyInputProps = fieldBackedProps({
	...baseInputProps,
	default: MoneySchema.optional(),
	min: z.number().optional(),
	max: z.number().optional(),
	currency: CurrencyCodeSchema.optional(),
}, (props) => ({ type: "money", ...props }));

const percentageInputProps = fieldBackedProps({
	...baseInputProps,
	default: z.number().optional(),
	min: z.number().optional(),
	max: z.number().optional(),
	precision: z.number().optional(),
}, (props) => ({ type: "percentage", ...props }));

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

const enumPickerProps = fieldBackedProps({
	...baseInputProps,
	options: z.array(optionSchema),
	default: z.union([z.string(), z.number()]).optional(),
	/** "radio" or "dropdown". Mapper picks; consumer can override. */
	display: z.enum(["radio", "dropdown"]).optional(),
}, ({ options, display: _display, ...props }) => ({ type: "enum", enum: options, ...props }));

const multiSelectChipsProps = fieldBackedProps({
	...baseInputProps,
	options: z.array(optionSchema),
	default: z.array(z.union([z.string(), z.number()])).optional(),
	min: z.number().optional(),
	max: z.number().optional(),
}, ({ options, ...props }) => ({ type: "multiselect", enum: options, ...props }));

const dateInputProps = fieldBackedProps({
	...baseInputProps,
	/** ISO 8601 date (YYYY-MM-DD). */
	default: z.string().optional(),
	min: z.string().optional(),
	max: z.string().optional(),
}, (props) => ({ type: "date", ...props }));

const dateTimeInputProps = fieldBackedProps({
	...baseInputProps,
	/** ISO 8601 datetime. */
	default: z.string().optional(),
	min: z.string().optional(),
	max: z.string().optional(),
}, (props) => ({ type: "datetime", ...props }));

const timeInputProps = fieldBackedProps({
	...baseInputProps,
	/** HH:MM:SS. */
	default: z.string().optional(),
	min: z.string().optional(),
	max: z.string().optional(),
}, (props) => ({ type: "time", ...props }));

const durationInputProps = catalogObject({
	...baseInputProps,
	default: DurationSchema.optional(),
});

const emailInputProps = fieldBackedProps({
	...baseInputProps,
	placeholder: z.string().optional(),
	default: z.string().optional(),
	minLength: z.number().optional(),
	maxLength: z.number().optional(),
}, (props) => ({ type: "email", ...props }));

const phoneInputProps = catalogObject({
	...baseInputProps,
	default: PhoneSchema.optional(),
});

const uriInputProps = fieldBackedProps({
	...baseInputProps,
	placeholder: z.string().optional(),
	default: z.string().optional(),
	minLength: z.number().optional(),
	maxLength: z.number().optional(),
	pattern: z.string().optional(),
}, (props) => ({ type: "uri", ...props }));

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

const ratingStarsProps = fieldBackedProps({
	...baseInputProps,
	default: z.number().optional(),
	min: z.number().optional(),
	max: z.number().optional(),
	step: z.number().optional(),
}, (props) => ({ type: "rating", ...props }));

const fieldsetProps = catalogObject({
	...baseInputProps,
});

const listProps = fieldBackedProps({
	...baseInputProps,
	minItems: z.number().int().nonnegative().optional(),
	maxItems: z.number().int().nonnegative().optional(),
}, (props) => ({ type: "list", item: { type: "text" }, ...props }));

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
