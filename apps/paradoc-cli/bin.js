#!/usr/bin/env node
process.env.PARADOC_CLI_PACKAGE = 'paradoc-cli'
await import('@paradoc/cli/dist/index.js')
