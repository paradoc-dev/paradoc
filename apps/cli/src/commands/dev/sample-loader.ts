import type { DocumentData } from '@paradoc/react'
import type { SampleSource } from './discovery.js'

export type SampleModuleLoader = (source: SampleSource) => Promise<Record<string, unknown>>

/** Load discovery's sample candidates in order, using the export it names. */
export async function loadSampleData(
	sources: readonly SampleSource[],
	load: SampleModuleLoader,
): Promise<DocumentData | undefined> {
	for (const source of sources) {
		let module: Record<string, unknown>
		try {
			module = await load(source)
		} catch (error) {
			throw new Error(`Could not load sample ${source.relative}: ${error instanceof Error ? error.message : String(error)}`)
		}

		const exported = module[source.exportName]
		if (exported === undefined || exported === null) continue

		let value: unknown
		try {
			value = typeof exported === 'function' ? await (exported as () => unknown)() : exported
		} catch (error) {
			throw new Error(`Could not read sample ${source.relative}: ${error instanceof Error ? error.message : String(error)}`)
		}
		if (!isDocumentData(value)) {
			throw new Error(`Sample ${source.relative} must be an object with a fields object.`)
		}
		return {
			fields: value.fields,
			parties: value.parties ?? {},
			annexes: value.annexes ?? {},
		}
	}
	return undefined
}

function isDocumentData(value: unknown): value is DocumentData {
	return typeof value === 'object' && value !== null &&
		typeof (value as { fields?: unknown }).fields === 'object' &&
		(value as { fields?: unknown }).fields !== null
}
