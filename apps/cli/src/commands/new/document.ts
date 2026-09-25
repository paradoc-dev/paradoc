import { createArtifactCommand, type ArtifactOptions } from './artifact.js'
export type DocumentOptions = ArtifactOptions
export const createDocumentCommand = () => createArtifactCommand('document')
