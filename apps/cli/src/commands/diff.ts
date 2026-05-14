import { Command } from 'commander'
import kleur from 'kleur'
import * as Diff from 'diff'
import { LocalFileSystem } from '../utils/local-fs.js'

import {
  findRepoRoot,
  parseAndValidateArtifact,
  fileExists,
} from '../utils/project.js'

/**
 * Create the 'diff' command
 * Shows differences between artifact files
 *
 * TODO: Implement registry-based diff (compare local vs registry version)
 */
export function createDiffCommand(): Command {
  const diff = new Command('diff')

  diff
    .argument('<file1>', 'First artifact file to compare')
    .argument('<file2>', 'Second artifact file to compare')
    .description('Show differences between two artifact files')
    .option('--name-only', 'Show only if files differ (no content)')
    .action(async (file1: string, file2: string, options) => {
      try {
        // Find repo root or use current directory
        const repoRoot = (await findRepoRoot()) ?? process.cwd()
        const storage = new LocalFileSystem(repoRoot)

        // Resolve file paths
        const path1 = storage.getAbsolutePath(file1)
        const path2 = storage.getAbsolutePath(file2)

        // Check files exist
        if (!(await fileExists(path1))) {
          console.error(kleur.red(`File not found: ${file1}`))
          process.exit(1)
        }
        if (!(await fileExists(path2))) {
          console.error(kleur.red(`File not found: ${file2}`))
          process.exit(1)
        }

        // Read file contents
        const content1 = await storage.readFile(path1, 'utf-8')
        const content2 = await storage.readFile(path2, 'utf-8')

        // Check if files are identical
        if (content1 === content2) {
          console.log(kleur.gray('Files are identical'))
          process.exit(0)
        }

        if (options.nameOnly) {
          console.log('Files differ')
          process.exit(0)
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
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(kleur.red(`Error: ${message}`))
        process.exit(1)
      }
    })

  return diff
}
