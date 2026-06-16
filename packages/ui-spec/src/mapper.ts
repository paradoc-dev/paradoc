/**
 * Maps a Paradoc artifact field definition to a catalog spec node.
 *
 * Single switch over the 23 field types in @paradoc/types. For each field
 * type, picks the appropriate catalog component and constructs props from
 * the field's metadata (label, description, min/max, options, default, etc.).
 *
 * Pure function. No React, no I/O, no async.
 */

import type {
	FormField,
	FieldsetField,
	EnumOption,
	EnumOptionValue,
	EnumField,
	MultiselectField,
	TextField,
	NumberField,
	BooleanField,
	MoneyField,
	AddressField,
	PhoneField,
	DurationField,
	EmailField,
	UuidField,
	UriField,
	DateField,
	DatetimeField,
	TimeField,
	PersonField,
	OrganizationField,
	IdentificationField,
	PercentageField,
	RatingField,
	CoordinateField,
	BboxField,
} from "@paradoc/types";

import type { CatalogOption } from "./catalog.js";
import type { SpecNode } from "./spec.js";

/**
 * Mapping context. Optional values shape the produced spec.
 *
 * - `fieldPath`: artifact path (e.g. "/pet/species") attached to the spec
 *   so the resulting `submitFieldValue` action carries it through.
 * - `sourceLanguage`: BCP 47-style source language tag for authored labels.
 * - `targetLanguage`: BCP 47-style target language tag for rendered labels.
 * - `language`: deprecated alias for `targetLanguage`.
 * - `translateOption`: optional translator function for enum option labels. If
 *   absent, labels come from `option.label` and fall back to the canonical value.
 */
export type TranslateOptionInput = {
	value: EnumOptionValue;
	label?: string;
	sourceLanguage?: string;
	targetLanguage?: string;
};

export type MapperContext = {
	fieldPath?: string;
	sourceLanguage?: string;
	targetLanguage?: string;
	language?: string;
	translateOption?: (option: TranslateOptionInput) => string;
};

/**
 * Map a paradoc form field to a catalog spec node.
 */
function optionToCatalogOption(option: EnumOption, ctx: MapperContext): CatalogOption {
	const sourceLanguage = ctx.sourceLanguage ?? "en";
	const targetLanguage = ctx.targetLanguage ?? ctx.language;
	const label = ctx.translateOption
		? ctx.translateOption({
			value: option.value,
			label: option.label,
			sourceLanguage,
			targetLanguage,
		})
		: option.label ?? String(option.value);

	return { label, value: option.value };
}

export function fieldToSpec(field: FormField, ctx: MapperContext = {}): SpecNode {
	const baseProps = {
		label: field.label,
		description: field.description,
		required: typeof field.required === "boolean" ? field.required : undefined,
	};

	switch (field.type) {
		case "text":
			return {
				type: textOrTextArea(field),
				props: {
					...baseProps,
					default: field.default,
					minLength: field.minLength,
					maxLength: field.maxLength,
					pattern: field.pattern,
				},
				...optionalFieldPath(ctx),
			};

		case "boolean":
			return {
				type: "YesNoToggle",
				props: {
					...baseProps,
					default: (field as BooleanField).default,
				},
				...optionalFieldPath(ctx),
			};

		case "number":
			return {
				type: "NumberInput",
				props: {
					...baseProps,
					default: (field as NumberField).default,
					min: (field as NumberField).min,
					max: (field as NumberField).max,
				},
				...optionalFieldPath(ctx),
			};

		case "money":
			return {
				type: "MoneyInput",
				props: {
					...baseProps,
					default: (field as MoneyField).default,
					min: (field as MoneyField).min,
					max: (field as MoneyField).max,
				},
				...optionalFieldPath(ctx),
			};

		case "percentage":
			return {
				type: "PercentageInput",
				props: {
					...baseProps,
					default: (field as PercentageField).default,
					min: (field as PercentageField).min,
					max: (field as PercentageField).max,
					precision: (field as PercentageField).precision,
				},
				...optionalFieldPath(ctx),
			};

		case "enum": {
			const f = field as EnumField;
			const options: CatalogOption[] = f.enum.map((option) => optionToCatalogOption(option, ctx));
			return {
				type: "EnumPicker",
				props: {
					...baseProps,
					options,
					default: f.default,
					display: options.length <= 4 ? "radio" : "dropdown",
				},
				...optionalFieldPath(ctx),
			};
		}

		case "multiselect": {
			const f = field as MultiselectField;
			const options: CatalogOption[] = f.enum.map((option) => optionToCatalogOption(option, ctx));
			return {
				type: "MultiSelectChips",
				props: {
					...baseProps,
					options,
					default: f.default,
					min: f.min,
					max: f.max,
				},
				...optionalFieldPath(ctx),
			};
		}

		case "date":
			return {
				type: "DateInput",
				props: {
					...baseProps,
					default: (field as DateField).default,
					min: (field as DateField).min,
					max: (field as DateField).max,
				},
				...optionalFieldPath(ctx),
			};

		case "datetime":
			return {
				type: "DateTimeInput",
				props: {
					...baseProps,
					default: (field as DatetimeField).default,
					min: (field as DatetimeField).min,
					max: (field as DatetimeField).max,
				},
				...optionalFieldPath(ctx),
			};

		case "time":
			return {
				type: "TimeInput",
				props: {
					...baseProps,
					default: (field as TimeField).default,
					min: (field as TimeField).min,
					max: (field as TimeField).max,
				},
				...optionalFieldPath(ctx),
			};

		case "duration":
			return {
				type: "DurationInput",
				props: {
					...baseProps,
					default: (field as DurationField).default,
				},
				...optionalFieldPath(ctx),
			};

		case "email":
			return {
				type: "EmailInput",
				props: {
					...baseProps,
					default: (field as EmailField).default,
					minLength: (field as EmailField).minLength,
					maxLength: (field as EmailField).maxLength,
				},
				...optionalFieldPath(ctx),
			};

		case "phone":
			return {
				type: "PhoneInput",
				props: {
					...baseProps,
					default: (field as PhoneField).default,
				},
				...optionalFieldPath(ctx),
			};

		case "uri":
			return {
				type: "UriInput",
				props: {
					...baseProps,
					default: (field as UriField).default,
					minLength: (field as UriField).minLength,
					maxLength: (field as UriField).maxLength,
					pattern: (field as UriField).pattern,
				},
				...optionalFieldPath(ctx),
			};

		case "uuid":
			// UUIDs render as plain text inputs with a UUID-shaped pattern.
			return {
				type: "TextInput",
				props: {
					...baseProps,
					default: (field as UuidField).default,
					minLength: (field as UuidField).minLength,
					maxLength: (field as UuidField).maxLength,
					pattern:
						(field as UuidField).pattern ??
						"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
				},
				...optionalFieldPath(ctx),
			};

		case "address":
			return {
				type: "AddressForm",
				props: {
					...baseProps,
					default: (field as AddressField).default,
				},
				...optionalFieldPath(ctx),
			};

		case "person":
			return {
				type: "PersonForm",
				props: {
					...baseProps,
					default: (field as PersonField).default,
				},
				...optionalFieldPath(ctx),
			};

		case "organization":
			return {
				type: "OrganizationForm",
				props: {
					...baseProps,
					default: (field as OrganizationField).default,
				},
				...optionalFieldPath(ctx),
			};

		case "identification":
			return {
				type: "IdentificationInput",
				props: {
					...baseProps,
					default: (field as IdentificationField).default,
					allowedTypes: (field as IdentificationField).allowedTypes,
				},
				...optionalFieldPath(ctx),
			};

		case "rating":
			return {
				type: "RatingStars",
				props: {
					...baseProps,
					default: (field as RatingField).default,
					min: (field as RatingField).min,
					max: (field as RatingField).max,
					step: (field as RatingField).step,
				},
				...optionalFieldPath(ctx),
			};

		case "coordinate":
		case "bbox":
			// Geo primitives don't have a dedicated rich input today —
			// fall back to text input with structured-format guidance via
			// the description. Future work: dedicated CoordinateInput /
			// BboxInput components.
			return {
				type: "TextInput",
				props: {
					...baseProps,
					default:
						field.type === "coordinate"
							? formatCoordinateDefault((field as CoordinateField).default)
							: formatBboxDefault((field as BboxField).default),
					placeholder:
						field.type === "coordinate"
							? "lat,lng (e.g. 40.7128,-74.0060)"
							: "minX,minY,maxX,maxY",
				},
				...optionalFieldPath(ctx),
			};

		case "fieldset":
			return mapFieldset(field as FieldsetField, ctx);

		default: {
			// Exhaustiveness check: this should never compile if a new field
			// type is added to @paradoc/types and not handled above.
			const _exhaustive: never = field;
			throw new Error(
				`fieldToSpec: unhandled field type: ${JSON.stringify(_exhaustive)}`,
			);
		}
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function textOrTextArea(field: TextField): "TextInput" | "TextArea" {
	// Heuristic: if maxLength > 200, render as a multi-line area.
	if (field.maxLength !== undefined && field.maxLength > 200) {
		return "TextArea";
	}
	return "TextInput";
}

function optionalFieldPath(ctx: MapperContext): { fieldPath?: string } {
	return ctx.fieldPath !== undefined ? { fieldPath: ctx.fieldPath } : {};
}

function mapFieldset(field: FieldsetField, ctx: MapperContext): SpecNode {
	const children: SpecNode[] = [];
	const parentPath = ctx.fieldPath ?? "";

	for (const [key, child] of Object.entries(field.fields)) {
		const childPath = `${parentPath}/${key}`;
		children.push(
			fieldToSpec(child, {
				...ctx,
				fieldPath: childPath,
			}),
		);
	}

	return {
		type: "Fieldset",
		props: {
			label: field.label,
			description: field.description,
			required: typeof field.required === "boolean" ? field.required : undefined,
		},
		...optionalFieldPath(ctx),
		children,
	};
}

function formatCoordinateDefault(
	value: { lat?: number; lng?: number } | undefined,
): string | undefined {
	if (!value || value.lat === undefined || value.lng === undefined) return undefined;
	return `${value.lat},${value.lng}`;
}

function formatBboxDefault(
	value:
		| { southWest?: { lat?: number; lng?: number }; northEast?: { lat?: number; lng?: number } }
		| undefined,
): string | undefined {
	const sw = value?.southWest;
	const ne = value?.northEast;
	if (
		!sw ||
		!ne ||
		sw.lat === undefined ||
		sw.lng === undefined ||
		ne.lat === undefined ||
		ne.lng === undefined
	) {
		return undefined;
	}
	return `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
}
