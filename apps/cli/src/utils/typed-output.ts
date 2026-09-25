import { jsonToDts, jsonToTsModule, type Artifact } from '@paradoc/core'

import { LocalFileSystem } from './local-fs.js'
import { serializeArtifactFile } from './artifact-file.js'

export type TypedOutputFormat = 'typed' | 'ts'

interface WriteTypedOutputOptions {
  artifact: Artifact
  format: TypedOutputFormat
  primaryPath: string
  sourceJsonPath?: string
  writeSourceJson?: boolean
  beforeWrite?: (path: string) => Promise<void>
}

export interface TypedOutputResult {
  exportName: string
  writtenPaths: string[]
}

/** Derive the module export from the artifact identity, independent of its file name. */
export function artifactExportName(artifact: Artifact): string {
  const camel = artifact.name.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase())
  return /^[A-Za-z_$]/.test(camel) ? camel : `_${camel}`
}

/** Write either an embedded TypeScript module or a JSON module with declarations. */
export async function writeTypedOutput(
  storage: LocalFileSystem,
  options: WriteTypedOutputOptions,
): Promise<TypedOutputResult> {
  const { artifact, beforeWrite = async () => {} } = options
  const exportName = artifactExportName(artifact)
  const writtenPaths: string[] = []

  if (options.format === 'ts') {
    await beforeWrite(options.primaryPath)
    await storage.writeFile(options.primaryPath, jsonToTsModule(artifact, {
      artifactKind: artifact.kind,
      exportName,
    }))
    writtenPaths.push(options.primaryPath)
    return { exportName, writtenPaths }
  }

  const sourceJsonPath = options.sourceJsonPath ?? options.primaryPath
  if (options.writeSourceJson !== false) {
    await beforeWrite(sourceJsonPath)
    await storage.writeFile(sourceJsonPath, serializeArtifactFile(artifact, 'json'))
    writtenPaths.push(sourceJsonPath)
  }

  const declarationPath = `${sourceJsonPath}.d.ts`
  await beforeWrite(declarationPath)
  await storage.writeFile(declarationPath, jsonToDts(artifact, storage.basename(sourceJsonPath)))
  writtenPaths.push(declarationPath)
  return { exportName, writtenPaths }
}
