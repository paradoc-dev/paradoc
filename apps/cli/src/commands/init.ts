import { Command, Option } from 'commander'
import kleur from 'kleur'
import prompts from 'prompts'
import slugify from 'slugify'
import { LocalFileSystem } from '../utils/local-fs.js'
import { generateManifestTemplate } from '../utils/templates.js'
import { writeFile } from '../utils/file-writer.js'
import { findConfig } from '../utils/config.js'
import { trackEvent } from '../utils/telemetry.js'
import { ManifestSchema } from '@paradoc/schemas'

interface InitOptions {
  yes?: boolean
  name?: string
  description?: string
  visibility?: 'public' | 'private'
  nested?: boolean
  dryRun?: boolean
}

/**
 * Create the 'init' command
 * Initializes a new Paradoc project
 */
export function createInitCommand(): Command {
  const init = new Command('init')

  init
    .argument('[directory]', 'Directory to initialize (defaults to current directory)')
    .description('Initialize a new Paradoc project')
    .option('-y, --yes', 'Non-interactive mode (skip prompts)')
    .option('--name <name>', 'Project title (required in non-interactive mode)')
    .option('--description <desc>', 'Project description')
    .addOption(new Option('--visibility <visibility>', 'Project visibility (default: private)').choices(['public', 'private']))
    .option('--nested', 'Allow creating nested project inside existing project')
    .option('--dry-run', 'Preview without creating files')
    .action(async (directory?: string, options: InitOptions = {}) => {
      const { yes = false, dryRun = false } = options

      // Default organization slug (no auth required)
      const orgSlug = 'your-org'

      // Gather project configuration
      let projectTitle: string
      let projectDescription: string | undefined
      let projectVisibility: 'public' | 'private'
      let targetDirectory = directory

      try {
        if (yes) {
          // Non-interactive mode
          if (!options.name) {
            console.log()
            console.log(kleur.red('✗ --name is required when using --yes (non-interactive mode)'))
            console.log()
            console.log(kleur.gray('Example:'))
            console.log(kleur.white('  paradoc init --yes --name "My Project"'))
            console.log()
            process.exit(1)
          }

          projectTitle = options.name
          projectDescription = options.description
          projectVisibility = options.visibility || 'private'

          // Use directory if provided, otherwise default to current directory
          if (!targetDirectory) {
            targetDirectory = '.'
          }
        } else {
          // Interactive mode
          console.log()
          console.log(kleur.bold('Initialize Paradoc Project'))
          console.log()

          // Prompt for title
          const { title } = await prompts({
            type: 'text',
            name: 'title',
            message: 'Project title:',
            initial: options.name || 'My Paradoc Project',
            validate: (value: string) => value.trim().length > 0 || 'Project title is required',
          })
          if (!title) throw new Error('User force closed the prompt')
          projectTitle = title.trim()

          // Prompt for description (optional)
          const { description } = await prompts({
            type: 'text',
            name: 'description',
            message: 'Description (optional):',
            initial: options.description || '',
          })
          projectDescription = description?.trim() || undefined

          // Prompt for visibility
          const { visibility } = await prompts({
            type: 'select',
            name: 'visibility',
            message: 'Visibility:',
            choices: [
              { title: 'private', value: 'private' },
              { title: 'public', value: 'public' },
            ],
            initial: options.visibility === 'public' ? 1 : 0,
          })
          if (visibility === undefined) throw new Error('User force closed the prompt')
          projectVisibility = visibility as 'public' | 'private'

          // Prompt for directory if not provided
          if (!targetDirectory) {
            const slug = slugify(projectTitle, {
              lower: true,
              strict: true,
              trim: true,
            })
            const { projectDirectory } = await prompts({
              type: 'text',
              name: 'projectDirectory',
              message: `Where would you like to create this project? ${kleur.gray(`(${slug} or . for current)`)}:`,
              initial: slug,
              validate: (value: string) => value.trim().length > 0 || 'Directory is required',
            })
            if (!projectDirectory) throw new Error('User force closed the prompt')
            targetDirectory = projectDirectory.trim()
          }
        }

        // Ensure targetDirectory is set (should always be set by this point)
        if (!targetDirectory) {
          targetDirectory = '.'
        }

        const storage = new LocalFileSystem(targetDirectory)

        // Check if paradoc.json already exists in target directory
        const configPath = storage.joinPath('paradoc.json')
        try {
          if (await storage.exists('paradoc.json')) {
            console.log()
            console.log(kleur.red('✗ paradoc.json already exists in this directory'))
            console.log(kleur.gray(`  ${configPath}`))
            console.log()
            process.exit(1)
          }
        } catch (_error) {
          // File doesn't exist, which is fine
        }

        // Check for parent project
        const parentConfig = await findConfig(targetDirectory)
        let allowNested = options.nested || false

        if (parentConfig && !allowNested) {
          if (yes) {
            // Non-interactive mode: error if nested not explicitly allowed
            console.log()
            console.log(
              kleur.yellow('⚠️  Found an existing Paradoc project at:'),
              kleur.cyan(parentConfig)
            )
            console.log()
            console.log(kleur.gray("You're inside another Paradoc project."))
            console.log(kleur.gray('To create a nested project, add the --nested flag:'))
            console.log()
            console.log(kleur.white('  paradoc init --yes --nested --name <name>'))
            console.log()
            process.exit(1)
          } else {
            // Interactive mode: prompt user
            console.log()
            console.log(
              kleur.yellow('⚠️  Found an existing Paradoc project at:'),
              kleur.cyan(parentConfig)
            )
            console.log()
            const { confirmNested } = await prompts({
              type: 'confirm',
              name: 'confirmNested',
              message: 'Create nested project inside existing project?',
              initial: false,
            })

            if (!confirmNested) {
              console.log()
              console.log(kleur.gray('Initialization cancelled.'))
              console.log()
              process.exit(0)
            }
            allowNested = true
          }
        }

        // Create directory if it doesn't exist
        if (!dryRun && targetDirectory !== '.') {
          try {
            if (!(await storage.exists('.'))) {
              await storage.mkdir('.', true)
            }
          } catch (_error) {
            // Directory creation failed, but continue
          }
        }

        // Generate manifest template
        const slug = slugify(projectTitle, { lower: true, strict: true, trim: true })
        if (!slug) {
          throw new Error('Project title must contain at least one letter or number')
        }
        const template = generateManifestTemplate(projectTitle, {
          description: projectDescription,
          visibility: projectVisibility,
          org: orgSlug,
        })
        const parsedTemplate = ManifestSchema.safeParse(template)
        if (!parsedTemplate.success) {
          throw new Error(`Invalid project manifest: ${parsedTemplate.error.issues.map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`).join(', ')}`)
        }

        // Show summary in interactive mode
        if (!yes && !dryRun) {
          console.log()
          console.log(kleur.gray('Summary:'))
          console.log(kleur.gray(`  Title: ${projectTitle}`))
          console.log(kleur.gray(`  Name: @${orgSlug}/${slug}`))
          if (projectDescription) {
            console.log(kleur.gray(`  Description: ${projectDescription}`))
          }
          console.log(kleur.gray(`  Visibility: ${projectVisibility}`))
          console.log()
        }

        // Create the .paradoc directory. It marks the project root beside
        // paradoc.json (see findRepoRoot) and holds lock.json once an artifact
        // is installed.
        if (!dryRun) {
          try {
            await storage.mkdir(storage.joinPath('.paradoc'), true)
          } catch (error) {
            throw new Error(
              `Failed to create .paradoc directory: ${error instanceof Error ? error.message : String(error)}`
            )
          }
        }

        // Write paradoc.json
        await writeFile(configPath, parsedTemplate.data, { dryRun, format: 'json' })

        // Show success message
        if (!dryRun) {
          console.log(kleur.green('✓ Project initialized successfully!'))
          console.log()
          console.log(kleur.gray('Created:'))
          console.log(kleur.gray('  paradoc.json'))
          console.log(kleur.gray('  .paradoc/'))
          console.log()

          // Track init event (fire and forget)
          trackEvent('project.initialized', {
            properties: { visibility: projectVisibility },
          })
        } else {
          console.log(kleur.yellow('Dry run - would create:'))
          console.log(kleur.gray('  paradoc.json'))
          console.log(kleur.gray('  .paradoc/'))
          console.log()
        }
      } catch (error: any) {
        // Handle user cancellation (Ctrl+C)
        if (
          error.message?.includes('force closed') ||
          error.message?.includes('User force closed')
        ) {
          console.log()
          console.log(kleur.yellow('Cancelled. Nothing was created.'))
          console.log()
          process.exit(0)
        }
        // Re-throw other errors
        throw error
      }
    })

  return init
}
