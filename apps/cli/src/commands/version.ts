import { Command } from 'commander'
import kleur from 'kleur'
import semver from 'semver'
import { validate, type Artifact } from '@paradoc/core'
import { LocalFileSystem } from '../utils/local-fs.js'
import { ensureRepo, fileExists } from '../utils/project.js'
import { parseArtifactFile, writeArtifactEdit } from '../utils/artifact-file.js'
import { isValidSemver } from '../utils/security.js'

/**
 * Create the 'version' command
 * Bumps semantic version in artifact files
 */
export function createVersionCommand(): Command {
  const version = new Command('version')

  version
    .argument('<file>', 'Artifact file to bump version')
    .argument('<bump-type>', 'Bump type (major, minor, patch, etc.) or specific version')
    .description('Bump semantic version in an artifact file')
    .action(async (file: string, bumpType: string) => {
      try {
        // Ensure in valid repository
        const repoRoot = await ensureRepo()
        process.chdir(repoRoot)

        const storage = new LocalFileSystem(repoRoot)

        // Verify file exists
        if (!(await fileExists(file))) {
          throw new Error(`File not found: ${file}`)
        }

        // Read file content
        const content = await storage.readFile(file)
        const ext = storage.extname(file).toLowerCase()

        // Parse artifact (auto-detects format)
        if (!['.json', '.yaml', '.yml'].includes(ext)) {
          throw new Error(`Unsupported file type: ${ext}`)
        }

        const artifact = parseArtifactFile(content) as Record<string, unknown>

        // Validate artifact
        const result = validate(artifact)
        if (result.issues) {
          const issueMessages = result.issues
            .map((issue) => {
              const path = issue.path ? issue.path.join('.') : 'root'
              return `${path}: ${issue.message}`
            })
            .join(', ')
          throw new Error(`Invalid artifact: ${issueMessages}`)
        }

        // Get current version
        const currentVersion = artifact.version as string | undefined

        if (!currentVersion) {
          throw new Error('Artifact does not have a version field')
        }

        // Calculate new version
        let newVersion: string | null

        // Check if bumpType is a specific version (e.g., "2.5.0" or "2.5.0-rc.1")
        if (isValidSemver(bumpType)) {
          // User specified exact version
          newVersion = bumpType
        } else {
          // User specified bump type (major, minor, patch, etc.)
          const validBumpTypes = [
            'major',
            'minor',
            'patch',
            'premajor',
            'preminor',
            'prepatch',
            'prerelease',
          ]

          if (!validBumpTypes.includes(bumpType)) {
            throw new Error(
              `Invalid bump type: ${bumpType}\n` +
                `Valid types: ${validBumpTypes.join(', ')}, or a specific version`
            )
          }

          // Bump the version
          newVersion = semver.inc(currentVersion, bumpType as semver.ReleaseType)
        }

        if (!newVersion) {
          throw new Error(`Failed to calculate new version from: ${currentVersion}`)
        }

        // Check if version changed
        if (newVersion === currentVersion) {
          console.log(kleur.gray(`Version unchanged: ${currentVersion}`))
          process.exit(0)
        }

        // Update artifact with new version
        artifact.version = newVersion

        await writeArtifactEdit(storage, file, content, artifact as unknown as Artifact)

        // Output success message
        console.log(kleur.green(`✓ Version bumped: ${currentVersion} → ${newVersion}`))
        console.log('')
        console.log(kleur.gray(`Updated: ${file}`))
      } catch (error: any) {
        console.error(kleur.red(`Error: ${error.message || String(error)}`))
        process.exit(1)
      }
    })

  return version
}
