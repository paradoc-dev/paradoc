/**
 * The project's own `@paradoc/react/discovery`, loaded for this project.
 *
 * The conventions live in the package, not here, so `para dev` and `para check`
 * cannot disagree about what a composition is or which artifact renders it. The
 * package is resolved at the project for the same reason `react` is: the answer
 * has to come from the copy the preview compiles against.
 */

import type * as Discovery from '@paradoc/react/discovery'

import { importPeer } from './peers.js'

export type { DiscoveredComposition, SampleSource } from '@paradoc/react/discovery'

/**
 * `@paradoc/react/discovery` for one project.
 *
 * @throws {MissingDevPeerError} when the project has no `@paradoc/react`.
 */
export async function loadDiscovery(root: string): Promise<typeof Discovery> {
	return (await importPeer(root, '@paradoc/react/discovery')) as unknown as typeof Discovery
}
