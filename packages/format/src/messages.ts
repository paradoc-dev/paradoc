import type { FormatterMessages } from './types'

/**
 * A package message that neither the requested locale nor the fallback locale
 * carries. The formatter reports it as `unsupported` / `missing_message`, so an
 * English label never leaks into a localized document.
 */
export class MissingMessageError extends Error {
	constructor(readonly key: string, readonly locale: string) {
		super(`No formatter message ${JSON.stringify(key)} is available for locale ${JSON.stringify(locale)}.`)
		this.name = 'MissingMessageError'
	}
}

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

/** The message sources one formatting call reads. */
export interface MessageContext {
	readonly locale: string
	readonly messages: FormatterMessages
	readonly fallbackLocale?: string
}

/**
 * Resolves a package-owned message, trying the requested locale and then the
 * formatter's explicit fallback locale. A message neither carries is a missing
 * resource the caller must supply.
 */
export function resolveMessage(context: MessageContext, key: string): string {
	const message = findMessage(context.messages, context.locale, key)
	if (message !== undefined) return message
	if (context.fallbackLocale !== undefined) {
		const fallbackMessage = findMessage(context.messages, context.fallbackLocale, key)
		if (fallbackMessage !== undefined) return fallbackMessage
	}
	throw new MissingMessageError(key, context.locale)
}
