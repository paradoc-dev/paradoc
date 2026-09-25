import { createArtifactCommand, type ArtifactOptions } from './artifact.js'
export type ChecklistOptions = ArtifactOptions
export const createChecklistCommand = () => createArtifactCommand('checklist')
