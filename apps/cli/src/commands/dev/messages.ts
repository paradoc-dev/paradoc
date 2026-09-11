/**
 * What the preview says when a composition cannot be drawn.
 *
 * Both halves of `paradoc dev` reach the same conclusions about the same
 * composition — the page draws it, the PDF route renders it — and a person
 * reading the two panes should not be told two different things about one
 * fault. So the wording lives here, is computed once per composition when the
 * manifest is written, and travels to the page with it.
 */

import type { DiscoveredComposition, SampleSource } from './discovery.js'

/** The messages one composition may need, settled before either half runs. */
export interface CompositionMessages {
	/** No sample data anywhere the conventions look. */
	noSample: string
	/** The module has no default export that is a component. */
	noComponent: string
	/** The sample was found but is not document data. */
	badSample: string
}

/** Where the sample conventions looked, in words. */
function sampleConventions(entry: DiscoveredComposition): string {
	const sibling = entry.samples.find((source: SampleSource) => source.from === 'sibling')
	return sibling
		? `${sibling.relative} exports neither a default nor a \`sample\``
		: `${entry.relative} has no \`sample\` export, and no <name>.sample.ts sits beside it`
}

/** Every message one composition may need. */
export function messagesFor(entry: DiscoveredComposition): CompositionMessages {
	return {
		noSample:
			`No sample data for ${entry.relative}: ${sampleConventions(entry)}. ` +
			'A composition previews with a sibling <name>.sample.ts whose default export is the data, ' +
			'or with a `sample` export on the composition itself. The shape is { fields, parties }.',
		noComponent:
			`${entry.relative} has no default export that is a component. A composition is bound ` +
			"through its module's default export, which is what the React layer's path names.",
		badSample:
			`The sample for ${entry.relative} is not document data. It must be an object ` +
			"{ fields, parties }, where fields holds the artifact's values.",
	}
}

/** How a composition's artifact is written in one line, on the page and in the terminal. */
export function bindingLabel(entry: DiscoveredComposition): string {
	if (!entry.artifact) return 'no artifact'
	return entry.artifact.layer
		? `${entry.artifact.relative}#${entry.artifact.layer}`
		: `${entry.artifact.relative} (sibling)`
}

/** How a composition's sample is written in one line. */
export function sampleLabel(entry: DiscoveredComposition): string {
	const first = entry.samples[0]
	return first && first.from === 'sibling' ? first.relative : 'sample export'
}
