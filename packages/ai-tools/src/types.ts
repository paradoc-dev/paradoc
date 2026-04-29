export interface ValidateOutput {
  valid: boolean
  detectedKind?: 'form' | 'document' | 'bundle' | 'checklist'
  issues?: Array<{ message: string; path?: (string | number)[] }>
  error?: string
}

export interface ValidateInputValueOutput {
  valid: boolean
  target?: 'field' | 'party' | 'annex' | 'checklistItem'
  artifactKind?: 'form' | 'document' | 'bundle' | 'checklist'
  normalizedValue?: unknown
  errors?: Array<{ field: string; message: string }>
  error?: string
}

export interface FillOutput {
  valid: boolean
  artifactKind?: 'form' | 'checklist'
  data?: Record<string, unknown>
  errors?: Array<{ field: string; message: string }>
  error?: string
}

export interface RenderOutput {
  success: boolean
  artifactKind?: string
  content?: string
  encoding?: 'utf-8' | 'base64'
  mimeType?: string
  error?: string
  errors?: Array<{ field: string; message: string }>
  validationIssues?: Array<{ message: string; path?: (string | number)[] }>
}

export interface GetRegistryOutput {
  name?: string
  artifactsPath?: string
  items: Array<{ name: string; path?: string }>
  error?: string
}

export interface GetArtifactOutput {
  artifact?: Record<string, unknown>
  artifactName?: string
  instructions?: {
    kind: 'inline' | 'file'
    mimeType?: string
    path?: string
    content: string
    encoding: 'utf-8' | 'base64'
  }
  agentInstructions?: {
    kind: 'inline' | 'file'
    mimeType?: string
    path?: string
    content: string
    encoding: 'utf-8' | 'base64'
  }
  error?: string
}
