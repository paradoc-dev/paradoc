import { createArtifactCommand, type ArtifactOptions } from './artifact.js'
export type FormOptions = ArtifactOptions
export const createFormCommand = () => createArtifactCommand('form')
