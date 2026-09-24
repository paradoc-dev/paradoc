/**
 * Bundle Artifact - Closure-based implementation
 * Barrel export
 */

export { bundle, runtimeBundleFromJSON, runtimeContentFromJSON } from './bundle'
export { assertBundleInclusionResolved, evaluateBundleInclusion } from './inclusion'
export type {
	BundleInclusionDecision,
	BundleInclusionState,
	BundleInclusionStatus,
} from './inclusion'
export type {
	BundleInstance,
	RuntimeBundle,
	DraftBundle,
	SignableBundle,
	ExecutedBundle,
	BundleInput,
	RuntimeBundleJSON,
	RuntimeInstance,
	RuntimeBundleContents,
	RuntimeBundleRenderOptions,
	RuntimeBundleRenderedOutput,
	RuntimeBundleRendered,
	BundleBuilderInterface,
} from './bundle'
