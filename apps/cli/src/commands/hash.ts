import { Command } from 'commander'
import { createHash } from 'node:crypto'
import kleur from 'kleur'

import { readBinaryInput } from '../utils/io.js'

interface HashOptions {
  json?: boolean
  algorithm?: string
}

export function createHashCommand(): Command {
  const hash = new Command('hash')

  hash
    .argument('<file>', 'File to compute hash for, or "-" for stdin')
    .description('Compute SHA256 checksum of a file (for use in layer definitions)')
    .option('--json', 'Output as JSON')
    .option('-a, --algorithm <algorithm>', 'Hash algorithm (default: sha256)', 'sha256')
    .action(async (file: string, options: HashOptions) => {
      try {
        const algorithm = options.algorithm || 'sha256'

        // Validate algorithm
        if (algorithm !== 'sha256') {
          console.error(kleur.red(`Unsupported algorithm: ${algorithm}. Only sha256 is supported.`))
          process.exit(1)
          return
        }

        // Read file content (supports stdin via "-")
        const { data, sourcePath } = await readBinaryInput(file)

        // Compute hash
        const hashObj = createHash(algorithm)
        hashObj.update(data)
        const hashHex = hashObj.digest('hex')
        const checksum = `${algorithm}:${hashHex}`

        if (options.json) {
          const output: Record<string, string> = {
            checksum,
            algorithm,
            hash: hashHex,
          }
          if (sourcePath) {
            output.path = sourcePath
          }
          console.log(JSON.stringify(output, null, 2))
        } else {
          console.log(checksum)
        }

        process.exit(0)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(kleur.red(`Error: ${message}`))
        process.exit(1)
      }
    })

  return hash
}
