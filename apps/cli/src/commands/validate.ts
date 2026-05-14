import { Command } from 'commander'
import kleur from 'kleur'
import {
  parse,
  validate as validateArtifact,
  type Artifact,
  type Layer,
} from '@paradoc/core'

import { readTextInput, resolveArtifactTarget } from '../utils/io.js'
import { LocalFileSystem } from '../utils/local-fs.js'
import { verifyHashFromFile } from '../utils/hash.js'

interface ValidateOptions {
  json?: boolean
  silent?: boolean
  expectKind?: string
  schemaOnly?: boolean
  layersOnly?: boolean
  checksumOnly?: boolean
}

/** Validation issue with severity */
interface ValidationIssue {
  message: string
  path?: string[]
  severity: 'error' | 'warning'
}

/** Per-layer check result */
interface LayerCheckResult {
  key: string
  kind: 'file' | 'inline'
  mimeType: string
  path?: string
  fileExists?: boolean
  checksumExpected?: string
  checksumMatch?: boolean
  issues: ValidationIssue[]
}

/** Per-ContentRef check result */
interface ContentRefCheckResult {
  field: string              // "instructions" | "agentInstructions"
  kind: 'file' | 'inline'
  mimeType?: string
  path?: string
  fileExists?: boolean
  checksumExpected?: string
  checksumMatch?: boolean
  issues: ValidationIssue[]
}

export function createValidateCommand(): Command {
  const validate = new Command('validate')

  validate
    .argument('<artifact>', 'Artifact file (JSON/YAML) or "-" for stdin')
    .description('Validate any Paradoc artifact against the core schema')
    .option('--json', 'Output machine-readable JSON result')
    .option('--silent', 'Suppress console output (exit code only)')
    .option('--expect-kind <kind>', 'Assert artifact kind (form, document, checklist, bundle)')
    .option('--schema-only', 'Only validate artifact schema (skip layer checks)')
    .option('--layers-only', 'Only validate layers (paths + checksums)')
    .option('--checksum-only', 'Only verify layer checksums')
    .action(async (artifactTarget: string, options: ValidateOptions) => {
      try {
        // Validate flag exclusivity
        const scopeFlags = [options.schemaOnly, options.layersOnly, options.checksumOnly].filter(Boolean)
        if (scopeFlags.length > 1) {
          console.error(kleur.red('Error: --schema-only, --layers-only, and --checksum-only are mutually exclusive.'))
          process.exit(1)
          return
        }

        const resolvedTarget = await resolveArtifactTarget(artifactTarget)
        const { raw, baseDir, fromStdin } = await readTextInput(resolvedTarget)
        const parsed = parse(raw)

        const result = validateArtifact(parsed)
        const hasValue = 'value' in result
        const schemaIssues: ValidationIssue[] = []
        const layerChecks: LayerCheckResult[] = []
        let layersSkipped = false
        let layersSkipReason: string | undefined

        // Schema validation phase — always run internally (needed for layer extraction),
        // but only collect/report schema issues unless --layers-only or --checksum-only
        const reportSchema = !options.layersOnly && !options.checksumOnly

        if (reportSchema) {
          for (const issue of result.issues ?? []) {
            schemaIssues.push({
              message: issue.message,
              path: issue.path?.map((segment) => String(segment)),
              severity: 'error',
            })
          }

          if (hasValue && !schemaIssues.length && options.expectKind) {
            const artifact = result.value as Artifact
            if (artifact.kind !== options.expectKind) {
              schemaIssues.push({
                message: `Expected kind "${options.expectKind}" but received "${artifact.kind}".`,
                path: ['kind'],
                severity: 'error',
              })
            }
          }
        }

        const artifact = hasValue ? (result.value as Artifact) : undefined
        const contentRefChecks: ContentRefCheckResult[] = []

        // Layer validation phase
        const skipLayers = options.schemaOnly || !hasValue
        const hasLayers = artifact && 'layers' in artifact && artifact.layers

        if (skipLayers) {
          if (hasLayers) {
            layersSkipped = true
            layersSkipReason = options.schemaOnly ? '--schema-only' : 'schema validation failed'
          }
        } else if (hasLayers) {
          if (fromStdin) {
            layersSkipped = true
            layersSkipReason = 'reading from stdin (no file context)'
          } else {
            const layers = artifact.layers as Record<string, Layer>
            const storage = new LocalFileSystem(baseDir)

            for (const [layerKey, layer] of Object.entries(layers)) {
              const check: LayerCheckResult = {
                key: layerKey,
                kind: layer.kind,
                mimeType: layer.mimeType,
                issues: [],
              }

              if (layer.kind !== 'file') {
                layerChecks.push(check)
                continue
              }

              check.path = layer.path
              check.checksumExpected = layer.checksum

              const absPath = storage.getAbsolutePath(layer.path)
              const fileExists = await storage.exists(absPath)
              check.fileExists = fileExists

              if (!options.checksumOnly && !fileExists) {
                check.issues.push({
                  message: `Layer file not found: ${layer.path}`,
                  path: ['layers', layerKey, 'path'],
                  severity: 'warning',
                })
                layerChecks.push(check)
                continue
              }

              if (fileExists && layer.checksum) {
                const matches = await verifyHashFromFile(absPath, layer.checksum)
                check.checksumMatch = matches
                if (!matches) {
                  check.issues.push({
                    message: `Checksum mismatch. Run \`para fix\` to update.`,
                    path: ['layers', layerKey, 'checksum'],
                    severity: 'error',
                  })
                }
              } else if (fileExists && !layer.checksum) {
                check.issues.push({
                  message: `No checksum set. Run \`para fix\` to add one.`,
                  path: ['layers', layerKey, 'checksum'],
                  severity: 'warning',
                })
              }

              layerChecks.push(check)
            }
          }
        }

        // ContentRef validation phase (instructions, agentInstructions)
        if (!options.schemaOnly && hasValue && !fromStdin) {
          const contentRefFields = ['instructions', 'agentInstructions'] as const
          const artifactRecord = artifact as unknown as Record<string, unknown>

          for (const field of contentRefFields) {
            const ref = artifactRecord[field] as { kind: string; path?: string; mimeType?: string; checksum?: string } | undefined
            if (!ref || ref.kind !== 'file') continue

            const check: ContentRefCheckResult = {
              field,
              kind: 'file',
              mimeType: ref.mimeType,
              path: ref.path,
              checksumExpected: ref.checksum,
              issues: [],
            }

            const storage = new LocalFileSystem(baseDir)
            const absPath = storage.getAbsolutePath(ref.path!)
            const fileExists = await storage.exists(absPath)
            check.fileExists = fileExists

            if (!fileExists) {
              check.issues.push({
                message: `Content file not found: ${ref.path}`,
                path: [field, 'path'],
                severity: 'warning',
              })
              contentRefChecks.push(check)
              continue
            }

            if (ref.checksum) {
              const matches = await verifyHashFromFile(absPath, ref.checksum)
              check.checksumMatch = matches
              if (!matches) {
                check.issues.push({
                  message: `Checksum mismatch. Run \`para fix\` to update.`,
                  path: [field, 'checksum'],
                  severity: 'error',
                })
              }
            } else {
              check.issues.push({
                message: `No checksum set. Run \`para fix\` to add one.`,
                path: [field, 'checksum'],
                severity: 'warning',
              })
            }

            contentRefChecks.push(check)
          }
        }

        // Aggregate
        const allIssues = [
          ...schemaIssues,
          ...layerChecks.flatMap((c) => c.issues),
          ...contentRefChecks.flatMap((c) => c.issues),
        ]
        const hasErrors = allIssues.some((i) => i.severity === 'error')
        const ok = !hasErrors
        const sourceLabel = artifactTarget === '-' ? 'stdin' : artifactTarget

        if (options.json) {
          printJsonResult({
            ok,
            schemaIssues,
            layerChecks,
            contentRefChecks,
            layersSkipped,
            layersSkipReason,
            artifact: ok ? artifact : undefined,
            sourcePath: sourceLabel,
          })
        } else if (!options.silent) {
          printHumanResult({
            ok,
            schemaIssues,
            layerChecks,
            contentRefChecks,
            layersSkipped,
            layersSkipReason,
            artifact: ok ? artifact : undefined,
            sourcePath: sourceLabel,
          })
        }

        process.exit(ok ? 0 : 1)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (!options.silent) {
          console.error(kleur.red(`Error: ${message}`))
        }
        process.exit(1)
      }
    })

  return validate
}

interface ResultContext {
  ok: boolean
  schemaIssues: ValidationIssue[]
  layerChecks: LayerCheckResult[]
  contentRefChecks: ContentRefCheckResult[]
  layersSkipped: boolean
  layersSkipReason?: string
  artifact?: Artifact
  sourcePath?: string
}

function printJsonResult(context: ResultContext): void {
  const layerIssues = context.layerChecks.flatMap((c) => c.issues)
  const contentRefIssues = context.contentRefChecks.flatMap((c) => c.issues)
  const allIssues = [...context.schemaIssues, ...layerIssues, ...contentRefIssues]

  const payload = {
    ok: context.ok,
    source: context.sourcePath ?? 'stdin',
    artifact: context.artifact
      ? {
          name: context.artifact.name,
          kind: context.artifact.kind,
          version: context.artifact.version,
        }
      : undefined,
    errors: allIssues
      .filter((i) => i.severity === 'error')
      .map((e) => ({ message: e.message, path: e.path })),
    warnings: allIssues
      .filter((i) => i.severity === 'warning')
      .map((w) => ({ message: w.message, path: w.path })),
    layers: context.layerChecks.length > 0
      ? context.layerChecks.map((c) => ({
          key: c.key,
          kind: c.kind,
          mimeType: c.mimeType,
          ...(c.path !== undefined && { path: c.path }),
          ...(c.fileExists !== undefined && { fileExists: c.fileExists }),
          ...(c.checksumExpected !== undefined && { checksumExpected: c.checksumExpected }),
          ...(c.checksumMatch !== undefined && { checksumMatch: c.checksumMatch }),
          ok: c.issues.every((i) => i.severity !== 'error'),
        }))
      : undefined,
    contentRefs: context.contentRefChecks.length > 0
      ? context.contentRefChecks.map((c) => ({
          field: c.field,
          kind: c.kind,
          ...(c.mimeType !== undefined && { mimeType: c.mimeType }),
          ...(c.path !== undefined && { path: c.path }),
          ...(c.fileExists !== undefined && { fileExists: c.fileExists }),
          ...(c.checksumExpected !== undefined && { checksumExpected: c.checksumExpected }),
          ...(c.checksumMatch !== undefined && { checksumMatch: c.checksumMatch }),
          ok: c.issues.every((i) => i.severity !== 'error'),
        }))
      : undefined,
    ...(context.layersSkipped && { layersSkipped: true, layersSkipReason: context.layersSkipReason }),
  }

  console.log(JSON.stringify(payload, null, 2))
}

function printHumanResult(context: ResultContext): void {
  // Schema section
  if (context.schemaIssues.length > 0) {
    const hasSchemaErrors = context.schemaIssues.some((i) => i.severity === 'error')
    if (hasSchemaErrors) {
      console.error(kleur.red('✗ Schema validation failed:'))
    }
    for (const issue of context.schemaIssues) {
      const location = issue.path?.length ? issue.path.join('.') : 'root'
      if (issue.severity === 'error') {
        console.error(kleur.red(`  ✗ ${location}: ${issue.message}`))
      } else {
        console.log(kleur.yellow(`  ⚠ ${location}: ${issue.message}`))
      }
    }
  } else if (context.artifact) {
    console.log(kleur.green('✓ Schema'))
    console.log(`  Kind:    ${context.artifact.kind}`)
    console.log(`  Name:    ${context.artifact.name}`)
    console.log(`  Version: ${context.artifact.version ?? 'N/A'}`)
    console.log(`  Source:  ${context.sourcePath ?? 'stdin'}`)
  }

  // Layers section
  if (context.layersSkipped) {
    console.log('')
    console.log(kleur.dim(`- Layers: skipped (${context.layersSkipReason})`))
  } else if (context.layerChecks.length > 0) {
    console.log('')
    console.log(kleur.bold('Layers:'))

    for (const check of context.layerChecks) {
      if (check.kind === 'inline') {
        console.log(kleur.green(`  ✓ ${check.key}`) + kleur.dim(` [inline, ${check.mimeType}]`))
        continue
      }

      // File layer
      const hasError = check.issues.some((i) => i.severity === 'error')
      const hasWarning = check.issues.some((i) => i.severity === 'warning')

      const icon = hasError ? kleur.red('✗') : hasWarning ? kleur.yellow('⚠') : kleur.green('✓')
      const label = hasError ? kleur.red(check.key) : hasWarning ? kleur.yellow(check.key) : kleur.green(check.key)

      console.log(`  ${icon} ${label}` + kleur.dim(` [file, ${check.mimeType}]`))
      console.log(kleur.dim(`      path: ${check.path}`))

      // File existence
      if (check.fileExists === true) {
        console.log(`      file:     ${kleur.green('found')}`)
      } else if (check.fileExists === false) {
        console.log(`      file:     ${kleur.yellow('not found')}`)
      }

      // Checksum
      if (check.checksumMatch === true) {
        console.log(`      checksum: ${kleur.green('verified')}`)
      } else if (check.checksumMatch === false) {
        console.log(`      checksum: ${kleur.red('mismatch')}`)
      } else if (check.fileExists === true && !check.checksumExpected) {
        console.log(`      checksum: ${kleur.yellow('not set')}`)
      } else if (check.fileExists === false) {
        console.log(`      checksum: ${kleur.dim('skipped (file not found)')}`)
      }
    }
  }

  // Content References section
  if (context.contentRefChecks.length > 0) {
    console.log('')
    console.log(kleur.bold('Content References:'))

    for (const check of context.contentRefChecks) {
      const hasError = check.issues.some((i) => i.severity === 'error')
      const hasWarning = check.issues.some((i) => i.severity === 'warning')

      const icon = hasError ? kleur.red('✗') : hasWarning ? kleur.yellow('⚠') : kleur.green('✓')
      const label = hasError ? kleur.red(check.field) : hasWarning ? kleur.yellow(check.field) : kleur.green(check.field)

      console.log(`  ${icon} ${label}` + kleur.dim(` [file, ${check.mimeType ?? 'unknown'}]`))
      console.log(kleur.dim(`      path: ${check.path}`))

      // File existence
      if (check.fileExists === true) {
        console.log(`      file:     ${kleur.green('found')}`)
      } else if (check.fileExists === false) {
        console.log(`      file:     ${kleur.yellow('not found')}`)
      }

      // Checksum
      if (check.checksumMatch === true) {
        console.log(`      checksum: ${kleur.green('verified')}`)
      } else if (check.checksumMatch === false) {
        console.log(`      checksum: ${kleur.red('mismatch')}`)
      } else if (check.fileExists === true && !check.checksumExpected) {
        console.log(`      checksum: ${kleur.yellow('not set')}`)
      } else if (check.fileExists === false) {
        console.log(`      checksum: ${kleur.dim('skipped (file not found)')}`)
      }
    }
  }

  // Final verdict
  console.log('')
  if (context.ok) {
    const warningCount = [
      ...context.schemaIssues,
      ...context.layerChecks.flatMap((c) => c.issues),
      ...context.contentRefChecks.flatMap((c) => c.issues),
    ].filter((i) => i.severity === 'warning').length

    if (warningCount > 0) {
      console.log(kleur.green('✓ Valid') + kleur.yellow(` (${warningCount} warning${warningCount > 1 ? 's' : ''})`))
    } else {
      console.log(kleur.green('✓ Valid'))
    }
  } else {
    console.log(kleur.red('✗ Validation failed'))
  }
}
