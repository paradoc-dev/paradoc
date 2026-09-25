import { Command } from 'commander'
import kleur from 'kleur'
import * as Diff from 'diff'
import { resolve } from 'node:path'
import { LocalFileSystem } from '../utils/local-fs.js'

import {
  findRepoRoot,
  parseAndValidateArtifact,
  fileExists,
} from '../utils/project.js'

/** Exit statuses follow the POSIX `diff` convention. */
const EXIT_IDENTICAL = 0
const EXIT_DIFFERENT = 1
const EXIT_ERROR = 2

/**
 * Create the 'diff' command
 * Shows differences between artifact files.
 * Exits 0 when the files are identical, 1 when they differ, 2 on error.
 */
export function createDiffCommand(): Command {
  const diff = new Command('diff')

  diff
    .argument('<file1>', 'First artifact file to compare')
    .argument('<file2>', 'Second artifact file to compare')
    .description('Show differences between two artifact files')
    .option('--name-only', 'Print the paths of the files when they differ (no content)')
    .addHelpText('after', '\nExit status: 0 if the files are identical, 1 if they differ, 2 on error.')
    .exitOverride((err) => {
      process.exit(err.exitCode === 0 ? EXIT_IDENTICAL : EXIT_ERROR)
    })
    .action(async (file1: string, file2: string, options) => {
      try {
        // Find repo root or use current directory
        const repoRoot = (await findRepoRoot()) ?? process.cwd()
        const storage = new LocalFileSystem(repoRoot)

        // Resolve file paths
        const path1 = resolve(file1)
        const path2 = resolve(file2)

        // Check files exist
        if (!(await fileExists(path1))) {
          console.error(kleur.red(`File not found: ${file1}`))
          process.exitCode = EXIT_ERROR
          return
        }
        if (!(await fileExists(path2))) {
          console.error(kleur.red(`File not found: ${file2}`))
          process.exitCode = EXIT_ERROR
          return
        }

        // Read file contents
        const content1 = await storage.readFile(path1, 'utf-8')
        const content2 = await storage.readFile(path2, 'utf-8')

        // Check if files are identical
        if (content1 === content2) {
          if (!options.nameOnly) console.log(kleur.gray('Files are identical'))
          process.exitCode = EXIT_IDENTICAL
          return
        }

        if (options.nameOnly) {
          console.log(file1)
          console.log(file2)
          process.exitCode = EXIT_DIFFERENT
          return
        }

        // Try to parse as artifacts for richer comparison
        let artifact1Name = storage.basename(file1)
        let artifact2Name = storage.basename(file2)

        try {
          const a1 = await parseAndValidateArtifact(path1)
          artifact1Name = `${a1.name} (${a1.kind})`
        } catch {
          // Not a valid artifact, use filename
        }

        try {
          const a2 = await parseAndValidateArtifact(path2)
          artifact2Name = `${a2.name} (${a2.kind})`
        } catch {
          // Not a valid artifact, use filename
        }

        // Generate and display diff
        console.log(kleur.cyan(`--- ${artifact1Name}`))
        console.log(kleur.cyan(`+++ ${artifact2Name}`))
        console.log()

        const patch = Diff.createPatch(file1, content1, content2, file1, file2, { context: 3 })
        const lines = patch.split('\n')

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i] ?? ''
          // Skip patch metadata header lines (first 4)
          if (i < 4) continue

          if (line.startsWith('+++') || line.startsWith('---')) {
            console.log(kleur.gray(line))
          } else if (line.startsWith('@@')) {
            console.log(kleur.cyan(line))
          } else if (line.startsWith('+')) {
            console.log(kleur.green(line))
          } else if (line.startsWith('-')) {
            console.log(kleur.red(line))
          } else {
            console.log(line)
          }
        }
        process.exitCode = EXIT_DIFFERENT
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(kleur.red(`Error: ${message}`))
        process.exitCode = EXIT_ERROR
      }
    })

  return diff
}
