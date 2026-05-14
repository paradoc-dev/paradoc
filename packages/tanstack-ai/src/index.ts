import { toolDefinition } from '@tanstack/ai'
import {
  ValidateArtifactInputSchema,
  FillInputSchema,
  RenderInputSchema,
  GetRegistryInputSchema,
  GetArtifactInputSchema,
  executeValidateArtifact,
  executeFill,
  executeRender,
  executeGetRegistry,
  executeGetArtifact,
  type ParadocToolsConfig,
  type ValidateArtifactInput,
  type FillInput,
  type RenderInput,
  type GetRegistryInput,
  type GetArtifactInput,
} from '@paradoc/ai-tools'

export type { ParadocToolsConfig }
export type {
  ProxyTextRendererConfig,
  ValidateOutput,
  FillOutput,
  RenderOutput,
  GetRegistryOutput,
  GetArtifactOutput,
} from '@paradoc/ai-tools'

export function paradocTools(config?: ParadocToolsConfig) {
  return {
    validateArtifact: toolDefinition({
      name: 'validateArtifact',
      description: 'Validates an Paradoc artifact against its schema',
      inputSchema: ValidateArtifactInputSchema,
    }).server(async (input) => executeValidateArtifact(input as ValidateArtifactInput, config)),

    fill: toolDefinition({
      name: 'fill',
      description: 'Fills an Paradoc artifact with data and validates',
      inputSchema: FillInputSchema,
    }).server(async (input) => executeFill(input as FillInput, config)),

    render: toolDefinition({
      name: 'render',
      description: 'Renders an Paradoc artifact to PDF, markdown, or DOCX',
      inputSchema: RenderInputSchema,
    }).server(async (input) => executeRender(input as RenderInput, config)),

    getRegistry: toolDefinition({
      name: 'getRegistry',
      description: 'Fetches registry.json from a URL, returns available artifacts',
      inputSchema: GetRegistryInputSchema,
    }).server(async (input) => executeGetRegistry(input as GetRegistryInput, config)),

    getArtifact: toolDefinition({
      name: 'getArtifact',
      description: 'Fetches artifact JSON from a registry by name',
      inputSchema: GetArtifactInputSchema,
    }).server(async (input) => executeGetArtifact(input as GetArtifactInput, config)),
  }
}
