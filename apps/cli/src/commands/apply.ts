import { resolve } from 'node:path'
import { Command } from 'commander'
import kleur from 'kleur'
import * as Diff from 'diff'
import { LocalFileSystem } from '../utils/local-fs.js'

import { ensureRepo, fileExists, parseAndValidateArtifact } from '../utils/project.js'
import { sanitizePath } from '../utils/security.js'

type DiffPatch = ReturnType<typeof Diff.parsePatch>[number]
type DiffHunk = DiffPatch['hunks'][number]

interface PatchTarget {
  filename: string
  patch: DiffPatch
  oldContent: string
  isNewFile: boolean
  isDeletion: boolean
}

function normalizeFilename(patch: DiffPatch): string | null {
  const candidate = patch.newFileName ?? patch.oldFileName
  if (!candidate) return null
  return candidate.replace(/^[ab]\//, '')
}

function invertPatch(patch: DiffPatch): DiffPatch {
  return {
    ...patch,
    oldFileName: patch.newFileName,
    newFileName: patch.oldFileName,
    hunks: patch.hunks.map((hunk: DiffHunk) => ({
      ...hunk,
      oldStart: hunk.newStart,
      oldLines: hunk.newLines,
      newStart: hunk.oldStart,
      newLines: hunk.oldLines,
      lines: hunk.lines.map((line: string) => {
        if (line.startsWith('+')) return `-${line.slice(1)}`
        if (line.startsWith('-')) return `+${line.slice(1)}`
        return line
      }),
    })),
  }
}

async function buildTargets(
  patches: DiffPatch[],
  storage: LocalFileSystem
): Promise<PatchTarget[]> {
  const targets: PatchTarget[] = []

  for (const patch of patches) {
    const filename = normalizeFilename(patch)
    if (!filename) {
      console.warn(kleur.yellow('Warning: skipping patch with no filename'))
      continue
    }

    const safePath = sanitizePath(storage.getAbsolutePath('.'), filename)
    if (!safePath) {
      console.warn(kleur.yellow(`Warning: skipping patch with unsafe path: ${filename}`))
      continue
    }

    const exists = await fileExists(filename)
    const isNewFile = patch.oldFileName === '/dev/null'
    const isDeletion = patch.newFileName === '/dev/null'

    if (!exists && !isNewFile) {
      throw new Error(`File not found: ${filename}`)
    }

    let oldContent = ''
    if (exists) {
      oldContent = await storage.readFile(filename)
    } else if (isNewFile) {
      oldContent = ''
    } else {
      throw new Error(`File not found: ${filename}`)
    }

    targets.push({
      filename,
      patch,
      oldContent,
      isNewFile,
      isDeletion,
    })
  }

  if (targets.length === 0) {
    throw new Error('No applicable patches found')
  }

  return targets
}

function applyPatchToContent(content: string, patch: DiffPatch, reverse: boolean): string | false {
  const targetPatch = reverse ? invertPatch(patch) : patch
  return Diff.applyPatch(content, targetPatch, { fuzzFactor: 0 })
}

function shouldValidateArtifact(filename: string): boolean {
  return /\.(ya?ml|json)$/i.test(filename)
}

export function createApplyCommand(): Command {
  const apply = new Command('apply')

  apply
    .argument('<patch-file>', 'Patch file to apply')
    .description('Apply a unified diff patch to the working directory')
    .option('--check', 'Check if the patch can be applied cleanly')
    .option('--reverse', 'Apply the patch in reverse')
    .option('--dry-run', 'Show what would change without modifying files')
    .action(
      async (
        patchFile: string,
        options: { check?: boolean; reverse?: boolean; dryRun?: boolean }
      ) => {
        const { check = false, reverse = false, dryRun = false } = options

        try {
          // Resolve the patch path against the caller's directory before moving to the repo root.
          const patchPath = resolve(patchFile)
          const repoRoot = await ensureRepo()
          process.chdir(repoRoot)

          const storage = new LocalFileSystem(repoRoot)

          if (!(await fileExists(patchPath))) {
            throw new Error(`Patch file not found: ${patchFile}`)
          }

          const patchContent = await storage.readFile(patchPath)
          const parsedPatches = Diff.parsePatch(patchContent)

          if (!parsedPatches || parsedPatches.length === 0) {
            throw new Error('No valid patches found in file')
          }

          console.log(
            kleur.gray(
              `Found ${parsedPatches.length} file(s) in patch ${storage.basename(patchFile)}`
            )
          )
          console.log('')

          const targets = await buildTargets(parsedPatches, storage)

          const results: Array<{
            target: PatchTarget
            result: string | false
          }> = []

          for (const target of targets) {
            const result = applyPatchToContent(target.oldContent, target.patch, reverse)
            results.push({ target, result })
          }

          if (check) {
            let allOk = true
            console.log('Checking patches...')
            for (const { target, result } of results) {
              if (result === false) {
                allOk = false
                console.log(kleur.red(`✗ ${target.filename}: FAILED`))
              } else {
                console.log(kleur.green(`✓ ${target.filename}: OK`))
              }
            }
            console.log('')
            if (allOk) {
              console.log('All patches can be applied successfully')
              process.exit(0)
            } else {
              console.log('Some patches cannot be applied (conflicts detected)')
              process.exit(1)
            }
          }

          if (dryRun) {
            console.log('Dry run (no files modified):')
            console.log('')
            for (const { target, result } of results) {
              console.log(`Would patch: ${target.filename}`)
              if (result === false) {
                console.log('  Status: CONFLICT (cannot apply)')
              } else {
                const before = target.oldContent.split('\n').length
                const after = result.split('\n').length
                const delta = after - before
                console.log('  Status: OK')
                console.log(`  Lines: ${before} → ${after} (${delta >= 0 ? '+' : ''}${delta})`)
              }
              console.log('')
            }
            process.exit(0)
          }

          const conflicts = results.filter(({ result }) => result === false)
          if (conflicts.length > 0) {
            console.error(kleur.red(`Patch does not apply: ${conflicts.length} conflict(s) detected`))
            for (const { target } of conflicts) {
              console.error(kleur.red(`✗ ${target.filename}: patch does not apply (conflict detected)`))
            }
            console.log('')
            console.log('No files were modified.')
            console.log('')
            console.log('Tips:')
            console.log('  - Ensure working tree matches patch context')
            console.log('  - Try applying on the version the patch was created from')
            console.log('  - Resolve conflicts manually if needed')
            process.exit(1)
          }

          const applied: string[] = []
          const written: Array<{ target: PatchTarget; existedBefore: boolean }> = []

          try {
            for (const { target, result } of results) {
              if (result === false) continue

              const existedBefore = await fileExists(target.filename)
              const deletesFile = (target.isDeletion && !reverse) || (target.isNewFile && reverse)

              if (deletesFile) {
                if (existedBefore) {
                  written.push({ target, existedBefore })
                  await storage.deleteFile(target.filename)
                  console.log(kleur.green(`✓ Deleted ${target.filename}`))
                }
              } else {
                written.push({ target, existedBefore })
                await storage.writeFile(target.filename, result)
                console.log(kleur.green(`✓ Applied to ${target.filename}`))
              }

              applied.push(target.filename)
            }
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err)
            for (const { target, existedBefore } of written.reverse()) {
              if (existedBefore) {
                await storage.writeFile(target.filename, target.oldContent)
              } else if (await fileExists(target.filename)) {
                await storage.deleteFile(target.filename)
              }
            }
            throw new Error(`${message}. All changes from this patch were rolled back.`)
          }

          console.log('')
          console.log(
            kleur.green(
              `Successfully applied ${applied.length} patch(es)${reverse ? ' (reversed)' : ''}`
            )
          )
          console.log('')
          console.log('Modified files:')
          for (const filename of applied) {
            console.log(`  ${filename}`)
          }
          console.log('')

          if (applied.length > 0) {
            console.log('Validating modified artifacts...')
            for (const filename of applied) {
              if (!shouldValidateArtifact(filename)) continue
              try {
                await parseAndValidateArtifact(filename)
                console.log(kleur.gray(`  ✓ ${filename} is valid`))
              } catch (err) {
                const message = err instanceof Error ? err.message : String(err)
                console.warn(kleur.yellow(`  ⚠️  ${filename} may be invalid: ${message}`))
              }
            }
            console.log('')
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error)
          console.error(kleur.red(`Error: ${message}`))
          process.exit(1)
        }
      }
    )

  return apply
}
