import { createArtifactCommand, type ArtifactOptions } from './artifact.js'
export type BundleOptions = ArtifactOptions
export const createBundleCommand = () => createArtifactCommand('bundle')
