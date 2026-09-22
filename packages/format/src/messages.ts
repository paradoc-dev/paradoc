import type { FormatterMessages } from './types'

/**
 * Finds a package-owned message for a locale, falling back to any locale that
 * shares its language. Every value family resolves its messages this way, so a
 * `de-AT` document reads the `de-DE` resources rather than silently printing
 * English.
 */
export function findMessage(messages: FormatterMessages, locale: string, key: string): string | undefined {
	const exact = messages[locale]?.[key]
	if (exact !== undefined) return exact
	const language = locale.split('-')[0]
	const languageMessages = Object.entries(messages).find(([candidate]) => candidate.split('-')[0] === language)?.[1]
	return languageMessages?.[key]
}

/**
 * Resolves a package-owned message, trying the requested locale and then the
 * formatter's explicit fallback locale. A message neither carries is a missing
 * resource the caller must supply, so `onMissing` names it rather than letting
 * an English label leak into a localized document.
 */
export function resolveMessage(
	messages: FormatterMessages,
	locale: string,
	key: string,
	fallbackLocale: string | undefined,
	onMissing: (key: string, locale: string) => Error,
): string {
	const message = findMessage(messages, locale, key)
	if (message !== undefined) return message
	if (fallbackLocale !== undefined) {
		const fallbackMessage = findMessage(messages, fallbackLocale, key)
		if (fallbackMessage !== undefined) return fallbackMessage
	}
	throw onMissing(key, locale)
}
