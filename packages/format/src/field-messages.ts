import type { FormatterMessages } from './types'

/** Package-owned labels used by field-aware renderers for boolean values. */
export const BUILT_IN_FIELD_MESSAGES: FormatterMessages = {
	'en-US': { 'boolean.true': 'Yes', 'boolean.false': 'No' },
	'en-GB': { 'boolean.true': 'Yes', 'boolean.false': 'No' },
	'de-DE': { 'boolean.true': 'Ja', 'boolean.false': 'Nein' },
	'fr-FR': { 'boolean.true': 'Oui', 'boolean.false': 'Non' },
	'ar-SA': { 'boolean.true': 'نعم', 'boolean.false': 'لا' },
}
