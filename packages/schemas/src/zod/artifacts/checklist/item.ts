import { z } from 'zod';

// --- Status spec for checklist items (template-time) ---

const BooleanStatusSpecSchema = z.object({
	kind: z.literal('boolean'),
	default: z.boolean()
		.describe('Default status value (true/false) for new instances')
		.optional(),
}).meta({
	title: 'BooleanStatusSpec',
	description: 'Boolean status (e.g., incomplete/complete) with an optional default value.',
});

const EnumStatusOptionSchema = z.object({
	value: z.string()
		.min(1)
		.max(64)
		.describe('Internal status value (e.g., "todo", "in-progress", "done")'),
	label: z.string()
		.min(1)
		.max(256)
		.describe('Human-readable label for the status option'),
	description: z.string()
		.min(1)
		.max(2000)
		.describe('Optional description or help text for this status option')
		.optional(),
}).meta({
	title: 'EnumStatusOption',
}).strict();

const EnumStatusSpecSchema = z.object({
	kind: z.literal('enum'),
	options: z.array(EnumStatusOptionSchema)
		.min(1)
		.describe('Allowed status options'),
	default: z.string()
		.min(1)
		.max(64)
		.describe('Default status value for new instances (must match one of the option values)')
		.optional(),
}).meta({
	title: 'EnumStatusSpec',
	description: 'Enum-based status with a set of allowed options and an optional default.',
});

const StatusSpecSchema = z.discriminatedUnion('kind', [
	BooleanStatusSpecSchema,
	EnumStatusSpecSchema,
]).meta({
	title: 'StatusSpec',
	description: 'Specification for how checklist item status should be represented (boolean or enum).',
});

// --- Checklist item (template-time definition) ---

export const ChecklistItemSchema = z.object({
	id: z.string()
		.min(1)
		.max(128)
		.describe('Unique identifier for the checklist item (e.g., "task-1", "step-a"). Used to link to runtime status.'),
	title: z.string()
		.min(1)
		.max(500)
		.describe('Title or label for the checklist item'),
	description: z.string()
		.min(1)
		.max(2000)
		.describe('Detailed description or instructions for the item')
		.optional(),
	status: StatusSpecSchema.optional(),
}).meta({
	title: 'ChecklistItem',
	description: 'A single item in a checklist artifact. Each item has an ID, title, optional description, and an optional status specification (boolean or enum). If status is omitted, a default boolean status may be assumed (implementation-defined).',
}).strict();
